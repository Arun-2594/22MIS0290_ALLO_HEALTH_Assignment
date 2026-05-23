import { prisma } from "@/lib/prisma";
import { Prisma, Reservation } from "@prisma/client";

/**
 * Lazy expiry check: if a reservation is PENDING and past its expiry time,
 * atomically release the stock and update the reservation status.
 * Returns the updated reservation if expired, or the original if still valid.
 */
export async function checkAndExpireReservation(
  reservation: Reservation
): Promise<Reservation> {
  if (
    reservation.status !== "PENDING" ||
    new Date(reservation.expiresAt) > new Date()
  ) {
    return reservation;
  }

  // Reservation has expired — release it atomically
  return await prisma.$transaction(async (tx) => {
    // Re-fetch with lock to prevent race conditions
    const locked = await tx.$queryRaw<Reservation[]>`
      SELECT * FROM "Reservation"
      WHERE "id" = ${reservation.id}
      FOR UPDATE
    `;

    const current = locked[0];
    if (!current || current.status !== "PENDING") {
      return current ?? reservation;
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
    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: { status: "RELEASED" },
    });

    return updated;
  });
}

/**
 * Batch expiry: find all expired PENDING reservations and release them.
 * Used by the cron job.
 */
export async function expireAllPendingReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
  });

  if (expiredReservations.length === 0) return 0;

  // Process each in a transaction to maintain consistency
  let releasedCount = 0;

  for (const reservation of expiredReservations) {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the reservation row
        const locked = await tx.$queryRaw<Reservation[]>`
          SELECT * FROM "Reservation"
          WHERE "id" = ${reservation.id} AND "status" = 'PENDING'
          FOR UPDATE
        `;

        if (locked.length === 0) return;

        // Release stock
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
          },
        });

        // Update reservation
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });
      });

      releasedCount++;
    } catch (error) {
      console.error(
        `Failed to expire reservation ${reservation.id}:`,
        error
      );
    }
  }

  return releasedCount;
}
