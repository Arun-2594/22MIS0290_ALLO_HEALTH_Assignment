import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkAndExpireReservation } from "@/lib/expiry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reservations/:id
 *
 * Fetches a single reservation with lazy expiry check.
 * If the reservation is PENDING and past its expiry, it will be auto-released.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Lazy expiry check
    const checkedReservation = await checkAndExpireReservation(reservation);

    // Fetch product and warehouse details for display
    const [product, warehouse] = await Promise.all([
      prisma.product.findUnique({ where: { id: checkedReservation.productId } }),
      prisma.warehouse.findUnique({ where: { id: checkedReservation.warehouseId } }),
    ]);

    const responseBody = {
      id: checkedReservation.id,
      productId: checkedReservation.productId,
      warehouseId: checkedReservation.warehouseId,
      quantity: checkedReservation.quantity,
      status: checkedReservation.status,
      expiresAt: checkedReservation.expiresAt.toISOString(),
      createdAt: checkedReservation.createdAt.toISOString(),
      updatedAt: checkedReservation.updatedAt.toISOString(),
      idempotencyKey: checkedReservation.idempotencyKey,
      product: product
        ? { name: product.name, description: product.description, imageUrl: product.imageUrl }
        : null,
      warehouse: warehouse
        ? { name: warehouse.name, location: warehouse.location }
        : null,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Failed to fetch reservation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}
