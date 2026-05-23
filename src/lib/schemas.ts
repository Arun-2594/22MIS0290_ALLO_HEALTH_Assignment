import { z } from "zod";

/**
 * Schema for creating a new reservation.
 * Shared between API validation and frontend form validation.
 */
export const createReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

/**
 * Schema for reservation status enum.
 */
export const reservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RELEASED",
]);

export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

/**
 * Schema for a full reservation response.
 */
export const reservationResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: reservationStatusSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  idempotencyKey: z.string().nullable(),
});

export type ReservationResponse = z.infer<typeof reservationResponseSchema>;

/**
 * Schema for stock with availability calculation.
 */
export const stockWithAvailabilitySchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  warehouseLocation: z.string(),
  total: z.number(),
  reserved: z.number(),
  available: z.number(),
});

export type StockWithAvailability = z.infer<typeof stockWithAvailabilitySchema>;

/**
 * Schema for a product with its stock information.
 */
export const productWithStockSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
  stock: z.array(stockWithAvailabilitySchema),
});

export type ProductWithStock = z.infer<typeof productWithStockSchema>;

/**
 * Schema for warehouse response.
 */
export const warehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  createdAt: z.string(),
});

export type WarehouseResponse = z.infer<typeof warehouseSchema>;
