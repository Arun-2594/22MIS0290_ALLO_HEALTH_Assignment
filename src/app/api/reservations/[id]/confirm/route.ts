import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkAndExpireReservation } from "@/lib/expiry";
import {
  getIdempotentResponse,
  cacheIdempotentResponse,
} from "@/lib/idempotency";
import { Reservation } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirms a pending reservation:
 * - If expired: releases stock, sets status RELEASED, returns 410
 * - If valid: permanently consumes stock (decrement total and reserved), sets CONFIRMED
 * - Supports idempotency via Idempotency-Key header
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check idempotency
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const cachedResponse = await getIdempotentResponse(idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Find the reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Reservation not found or not in PENDING status" },
        { status: 404 }
      );
    }

    // Lazy expiry check
    if (new Date(reservation.expiresAt) < new Date()) {
      const expired = await checkAndExpireReservation(reservation);
      const responseBody = {
        id: expired.id,
        productId: expired.productId,
        warehouseId: expired.warehouseId,
        quantity: expired.quantity,
        status: expired.status,
        expiresAt: expired.expiresAt.toISOString(),
        createdAt: expired.createdAt.toISOString(),
        updatedAt: expired.updatedAt.toISOString(),
        idempotencyKey: expired.idempotencyKey,
        message: "Reservation has expired",
      };

      await cacheIdempotentResponse(idempotencyKey, 410, responseBody);
      return NextResponse.json(responseBody, { status: 410 });
    }

    // Confirm the reservation atomically
    const confirmed = await prisma.$transaction(async (tx) => {
      // Lock the reservation row
      const locked = await tx.$queryRaw<Reservation[]>`
        SELECT * FROM "Reservation"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const current = locked[0];
      if (!current || current.status !== "PENDING") {
        throw new Error("RESERVATION_NOT_PENDING");
      }

      // Check expiry again under lock
      if (new Date(current.expiresAt) < new Date()) {
        // Release stock
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: current.productId,
              warehouseId: current.warehouseId,
            },
          },
          data: {
            reserved: { decrement: current.quantity },
          },
        });

        return await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
      }

      // Permanently consume stock: decrement both total and reserved
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: current.productId,
            warehouseId: current.warehouseId,
          },
        },
        data: {
          total: { decrement: current.quantity },
          reserved: { decrement: current.quantity },
        },
      });

      // Update reservation to CONFIRMED
      return await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
    });

    const isExpired = confirmed.status === "RELEASED";
    const responseBody = {
      id: confirmed.id,
      productId: confirmed.productId,
      warehouseId: confirmed.warehouseId,
      quantity: confirmed.quantity,
      status: confirmed.status,
      expiresAt: confirmed.expiresAt.toISOString(),
      createdAt: confirmed.createdAt.toISOString(),
      updatedAt: confirmed.updatedAt.toISOString(),
      idempotencyKey: confirmed.idempotencyKey,
      ...(isExpired && { message: "Reservation has expired" }),
    };

    const statusCode = isExpired ? 410 : 200;
    await cacheIdempotentResponse(idempotencyKey, statusCode, responseBody);

    return NextResponse.json(responseBody, { status: statusCode });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RESERVATION_NOT_PENDING"
    ) {
      return NextResponse.json(
        { error: "Reservation not found or not in PENDING status" },
        { status: 404 }
      );
    }

    console.error("Failed to confirm reservation:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
