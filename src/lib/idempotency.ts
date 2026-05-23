import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Check if a cached response exists for the given idempotency key.
 * Returns the cached NextResponse if found, or null if not found.
 */
export async function getIdempotentResponse(
  idempotencyKey: string | null
): Promise<NextResponse | null> {
  if (!idempotencyKey) return null;

  const cacheKey = `idempotency:${idempotencyKey}`;
  const cached = await redis.get<CachedResponse>(cacheKey);

  if (cached) {
    return NextResponse.json(cached.body, { status: cached.status });
  }

  return null;
}

/**
 * Cache a response for the given idempotency key in Redis with 24h TTL.
 */
export async function cacheIdempotentResponse(
  idempotencyKey: string | null,
  status: number,
  body: unknown
): Promise<void> {
  if (!idempotencyKey) return;

  const cacheKey = `idempotency:${idempotencyKey}`;
  const cached: CachedResponse = { status, body };

  await redis.set(cacheKey, cached, { ex: IDEMPOTENCY_TTL_SECONDS });
}
