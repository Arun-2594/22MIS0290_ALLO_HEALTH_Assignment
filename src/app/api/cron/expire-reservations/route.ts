import { NextRequest, NextResponse } from "next/server";
import { expireAllPendingReservations } from "@/lib/expiry";

/**
 * GET /api/cron/expire-reservations
 *
 * Vercel Cron Job that runs every 5 minutes to batch-expire
 * all PENDING reservations that have passed their expiresAt time.
 *
 * Protected by CRON_SECRET env var — Vercel sets the Authorization header
 * automatically for cron jobs.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const releasedCount = await expireAllPendingReservations();

    return NextResponse.json({
      success: true,
      releasedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
