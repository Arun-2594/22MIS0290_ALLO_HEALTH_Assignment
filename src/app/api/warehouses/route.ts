import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/warehouses
 * Returns all warehouses.
 */
export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { createdAt: "asc" },
    });

    const response = warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      location: w.location,
      createdAt: w.createdAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch warehouses:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}
