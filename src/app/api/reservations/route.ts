import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createReservationSchema } from "@/lib/schemas";
import {
  getIdempotentResponse,
  cacheIdempotentResponse,
} from "@/lib/idempotency";
import { Stock } from "@prisma/client";

const RESERVATION_TTL_MINUTES = 10;

/**
 * POST /api/reservations
 *
 * Creates a new stock reservation with concurrency-safe row-level locking.
 * Supports idempotency via Idempotency-Key header.
 *
 * Concurrency strategy:
 * Uses SELECT ... FOR UPDATE inside a Prisma interactive transaction to acquire
 * a row-level lock on the Stock row. This serializes concurrent requests for
 * the same product+warehouse — exactly one of two simultaneous requests for
 * the last unit will succeed, the other gets a 409.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Check idempotency
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const cachedResponse = await getIdempotentResponse(idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Execute the reservation in a serializable transaction with row-level locking
    const reservation = await prisma.$transaction(async (tx) => {
      // Acquire row-level lock on the stock row
      const stockRows = await tx.$queryRaw<Stock[]>`
        SELECT * FROM "Stock"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (stockRows.length === 0) {
        throw new Error("STOCK_NOT_FOUND");
      }

      const stock = stockRows[0];
      const available = stock.total - stock.reserved;

      if (available < quantity) {
        throw new Error("NOT_ENOUGH_STOCK");
      }

      // Increment reserved count
      await tx.stock.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: {
          reserved: { increment: quantity },
        },
      });

      // Create the reservation
      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
          idempotencyKey,
        },
      });

      return newReservation;
    });

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
      idempotencyKey: reservation.idempotencyKey,
    };

    // Cache the response for idempotency
    await cacheIdempotentResponse(idempotencyKey, 201, responseBody);

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_ENOUGH_STOCK") {
        return NextResponse.json(
          { error: "Not enough stock available" },
          { status: 409 }
        );
      }
      if (error.message === "STOCK_NOT_FOUND") {
        return NextResponse.json(
          { error: "Stock not found for this product and warehouse" },
          { status: 404 }
        );
      }
    }

    console.error("Failed to create reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
