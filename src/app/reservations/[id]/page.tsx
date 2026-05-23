"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

interface ReservationDetail {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string | null;
  product: { name: string; description: string; imageUrl: string | null } | null;
  warehouse: { name: string; location: string } | null;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Pending",
        color: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
        icon: "⏳",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        color: "text-success",
        bg: "bg-success/10",
        border: "border-success/20",
        icon: "✅",
      };
    case "RELEASED":
      return {
        label: "Released",
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/20",
        icon: "🔓",
      };
    default:
      return {
        label: status,
        color: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-border",
        icon: "❓",
      };
  }
}

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasExpired, setHasExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Reservation not found");
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data: ReservationDetail = await res.json();
      setReservation(data);

      // Calculate time left
      if (data.status === "PENDING") {
        const expiresAt = new Date(data.expiresAt).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(diff);
        if (diff === 0) {
          setHasExpired(true);
        }
      }
    } catch {
      toast.error("Failed to load reservation details.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  // Countdown timer
  useEffect(() => {
    if (
      !reservation ||
      reservation.status !== "PENDING" ||
      hasExpired
    ) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer hit zero
          if (timerRef.current) clearInterval(timerRef.current);
          setHasExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reservation, hasExpired]);

  // Auto-release on expiry
  useEffect(() => {
    if (hasExpired && reservation?.status === "PENDING") {
      handleRelease(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExpired]);

  const handleConfirm = async () => {
    setActionLoading("confirm");
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      if (res.status === 410) {
        toast.error("This reservation has expired", {
          description: "The stock has been released back to inventory.",
        });
        const data = await res.json();
        setReservation((prev) =>
          prev ? { ...prev, status: data.status } : null
        );
        setHasExpired(true);
        return;
      }

      if (res.status === 404) {
        toast.error("Reservation not found or already processed");
        return;
      }

      if (!res.ok) throw new Error("Failed to confirm");

      const data = await res.json();
      setReservation((prev) =>
        prev ? { ...prev, status: data.status } : null
      );
      toast.success("Purchase confirmed!", {
        description: "Your order has been placed successfully.",
      });
    } catch {
      toast.error("Failed to confirm reservation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async (isAutoExpiry = false) => {
    if (!isAutoExpiry) setActionLoading("release");
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      if (!res.ok && res.status !== 400) throw new Error("Failed to release");

      const data = await res.json();
      setReservation((prev) =>
        prev
          ? { ...prev, status: data.status ?? "RELEASED" }
          : null
      );

      if (!isAutoExpiry) {
        toast.success("Reservation cancelled", {
          description: "Stock has been released back to inventory.",
        });
      } else {
        toast.warning("Reservation expired", {
          description: "The timer ran out. Stock has been released.",
        });
      }
    } catch {
      if (!isAutoExpiry) toast.error("Failed to release reservation");
    } finally {
      if (!isAutoExpiry) setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="skeleton h-8 w-48 mb-8" />
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="skeleton h-20 w-20 rounded-full mx-auto mb-6" />
          <div className="skeleton h-6 w-64 mx-auto mb-3" />
          <div className="skeleton h-4 w-48 mx-auto mb-8" />
          <div className="space-y-4">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold mb-2">Reservation not found</h2>
        <p className="text-muted-foreground mb-6">
          This reservation may have been removed or doesn&apos;t exist.
        </p>
        <a
          href="/"
          className="inline-flex rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
        >
          Back to Products
        </a>
      </div>
    );
  }

  const statusConfig = getStatusConfig(reservation.status);
  const isPending = reservation.status === "PENDING" && !hasExpired;
  const isTerminal =
    reservation.status === "CONFIRMED" || reservation.status === "RELEASED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 animate-fade-in">
      {/* Back Link */}
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Products
      </a>

      {/* Main Card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Status Banner */}
        <div
          className={`${statusConfig.bg} border-b ${statusConfig.border} px-6 py-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{statusConfig.icon}</span>
              <div>
                <h2 className={`text-lg font-semibold ${statusConfig.color}`}>
                  {reservation.status === "CONFIRMED"
                    ? "Purchase Confirmed!"
                    : reservation.status === "RELEASED"
                    ? hasExpired
                      ? "Reservation Expired"
                      : "Reservation Cancelled"
                    : "Reservation Active"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  ID: {reservation.id}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border px-3 py-1 text-xs font-semibold uppercase tracking-wider`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Countdown Timer — only for PENDING */}
          {isPending && (
            <div className="text-center py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Time Remaining
              </p>
              <div
                className={`inline-flex items-center justify-center text-5xl font-mono font-bold tracking-widest ${
                  timeLeft <= 60 ? "text-destructive" : timeLeft <= 180 ? "text-warning" : "text-foreground"
                }`}
              >
                {formatCountdown(timeLeft)}
              </div>
              {timeLeft <= 60 && timeLeft > 0 && (
                <p className="text-sm text-destructive mt-2 animate-pulse">
                  ⚠️ Hurry! Your reservation is about to expire
                </p>
              )}
              {/* Progress Bar */}
              <div className="mt-4 mx-auto max-w-xs">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                      timeLeft <= 60
                        ? "bg-destructive"
                        : timeLeft <= 180
                        ? "bg-warning"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, (timeLeft / 600) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Expired message when timer hits 0 */}
          {hasExpired && reservation.status !== "CONFIRMED" && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-3">
                <span className="text-3xl">⏰</span>
              </div>
              <p className="text-lg font-semibold text-destructive">
                This reservation has expired
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The stock has been released back to inventory.
              </p>
            </div>
          )}

          {/* Confirmed success state */}
          {reservation.status === "CONFIRMED" && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-3">
                <span className="text-3xl">🎉</span>
              </div>
              <p className="text-lg font-semibold text-success">
                Purchase confirmed!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your order has been placed successfully.
              </p>
            </div>
          )}

          {/* Reservation Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Product
              </p>
              <p className="text-sm font-semibold text-foreground">
                {reservation.product?.name ?? "Unknown Product"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {reservation.product?.description}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Warehouse
              </p>
              <p className="text-sm font-semibold text-foreground">
                {reservation.warehouse?.name ?? "Unknown Warehouse"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reservation.warehouse?.location}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Quantity
              </p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {reservation.quantity}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Reserved At
              </p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(reservation.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Action Buttons — only for PENDING and not expired */}
          {isPending && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleRelease()}
                disabled={actionLoading !== null}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "release" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Cancelling...
                  </span>
                ) : (
                  "Cancel Reservation"
                )}
              </button>
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 animate-pulse-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none"
              >
                {actionLoading === "confirm" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Confirming...
                  </span>
                ) : (
                  "Confirm Purchase"
                )}
              </button>
            </div>
          )}

          {/* Back to products after terminal state */}
          {isTerminal && (
            <div className="pt-2">
              <a
                href="/"
                className="flex items-center justify-center rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all"
              >
                ← Browse More Products
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
