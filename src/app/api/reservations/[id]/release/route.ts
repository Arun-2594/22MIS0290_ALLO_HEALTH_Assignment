import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Reservation } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reservations/:id/release
 *
 * Releases a pending reservation:
 * - If already RELEASED or CONFIRMED: returns appropriate error
 * - If PENDING: decrements reserved stock and sets status RELEASED
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        { error: "Reservation has already been released" },
        { status: 400 }
      );
    }

    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Reservation has already been confirmed and cannot be released" },
        { status: 400 }
      );
    }

    // Release atomically with row-level lock
    const released = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Reservation[]>`
        SELECT * FROM "Reservation"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const current = locked[0];
      if (!current || current.status !== "PENDING") {
        throw new Error("RESERVATION_NOT_PENDING");
      }

      // Release the reserved stock
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

      // Update reservation status
      return await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      });
    });

    const responseBody = {
      id: released.id,
      productId: released.productId,
      warehouseId: released.warehouseId,
      quantity: released.quantity,
      status: released.status,
      expiresAt: released.expiresAt.toISOString(),
      createdAt: released.createdAt.toISOString(),
      updatedAt: released.updatedAt.toISOString(),
      idempotencyKey: released.idempotencyKey,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RESERVATION_NOT_PENDING"
    ) {
      return NextResponse.json(
        { error: "Reservation is no longer in PENDING status" },
        { status: 400 }
      );
    }

    console.error("Failed to release reservation:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
