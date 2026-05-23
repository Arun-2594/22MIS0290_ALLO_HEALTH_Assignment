import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ProductWithStock } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/products
 * Returns all products with their available stock per warehouse.
 * Available stock = total - reserved
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const response: ProductWithStock[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      createdAt: product.createdAt.toISOString(),
      stock: product.stock.map((s) => ({
        id: s.id,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseLocation: s.warehouse.location,
        total: s.total,
        reserved: s.reserved,
        available: s.total - s.reserved,
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
