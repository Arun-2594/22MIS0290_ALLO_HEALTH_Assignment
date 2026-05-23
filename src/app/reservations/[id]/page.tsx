"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Lock, 
  Copy, 
  Check, 
  ArrowLeft,
  Calendar,
  Building,
  Box,
  CornerDownRight,
  TrendingUp,
  Loader2
} from "lucide-react";

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

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasExpired, setHasExpired] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [shakeTimer, setShakeTimer] = useState(false);
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
    if (!reservation || reservation.status !== "PENDING" || hasExpired) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setHasExpired(true);
          setShakeTimer(true);
          setTimeout(() => setShakeTimer(false), 500);
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
      
      // Update local storage count
      window.dispatchEvent(new Event("stockvault_reservation_change"));

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
        prev ? { ...prev, status: data.status ?? "RELEASED" } : null
      );

      // Update local storage count
      window.dispatchEvent(new Event("stockvault_reservation_change"));

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(id);
    setIsCopied(true);
    toast.success("ID copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 bg-[#0F0F13] min-h-screen text-[#F1F1F5]">
        <div className="skeleton h-8 w-44 mb-8 bg-[#1A1A24]" />
        <div className="rounded-3xl border border-[#2A2A3A] bg-[#1A1A24] p-8 space-y-6 shadow-xl">
          <div className="skeleton h-28 w-28 rounded-full mx-auto bg-[#2A2A3A]" />
          <div className="skeleton h-8 w-60 mx-auto bg-[#2A2A3A]" />
          <div className="skeleton h-4 w-40 mx-auto bg-[#2A2A3A]" />
          <div className="space-y-3 pt-6">
            <div className="skeleton h-16 w-full bg-[#2A2A3A]" />
            <div className="skeleton h-16 w-full bg-[#2A2A3A]" />
          </div>
        </div>
      </div>
    );
  }

  // 410 Expired Full Page State
  if (hasExpired && reservation?.status === "RELEASED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-[#0F0F13] min-h-screen text-[#F1F1F5] flex flex-col justify-center items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          className="rounded-3xl border border-[#EF4444]/20 bg-[#1A1A24] p-8 max-w-md w-full shadow-2xl flex flex-col items-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 mb-5">
            <Clock className="h-8 w-8 text-[#EF4444]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Reservation Expired</h2>
          <p className="text-[#8B8B9E] text-sm mb-6 leading-relaxed">
            This reservation has expired. The units have been returned to stock and made available for other users.
          </p>
          <a
            href="/"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-500 transition-all active:scale-95 cursor-pointer"
          >
            Browse Products
          </a>
        </motion.div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-[#0F0F13] min-h-screen text-[#F1F1F5] flex flex-col justify-center items-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 mb-5">
          <XCircle className="h-8 w-8 text-[#EF4444]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Reservation Not Found</h2>
        <p className="text-[#8B8B9E] mb-6 max-w-xs text-sm">
          This reservation could not be located or may have been deleted.
        </p>
        <a
          href="/"
          className="rounded-xl bg-gradient-to-r from-[#6366F1] to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:from-indigo-500 hover:to-indigo-500 transition-all cursor-pointer"
        >
          Back to Products
        </a>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING" && !hasExpired;
  
  // Color configuration based on time remaining
  let timerColor = "#22C55E";
  let timerTextClass = "text-[#22C55E]";
  if (timeLeft <= 60) {
    timerColor = "#EF4444";
    timerTextClass = "text-[#EF4444]";
  } else if (timeLeft <= 180) {
    timerColor = "#F59E0B";
    timerTextClass = "text-[#F59E0B]";
  }

  // Calculate SVG stroke offset (circumference of 60 radius circle is 377)
  const strokeDashoffset = 377 - (Math.min(600, timeLeft) / 600) * 377;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 bg-[#0F0F13] min-h-screen text-[#F1F1F5]">
      {/* Back Link */}
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-[#8B8B9E] hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Products
      </a>

      {/* Main Reservation Card */}
      <div className="rounded-3xl border border-[#2A2A3A] bg-[#1A1A24] overflow-hidden shadow-2xl">
        
        {/* Status Badge Header */}
        <div className="border-b border-[#2A2A3A] bg-[#0F0F13]/40 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {reservation.status === "PENDING" && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#F59E0B] animate-pulse" />
            )}
            {reservation.status === "CONFIRMED" && (
              <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
            )}
            {reservation.status === "RELEASED" && (
              <XCircle className="h-5 w-5 text-[#EF4444]" />
            )}
            <div>
              <span className="text-xs uppercase tracking-widest text-[#8B8B9E] font-bold">
                Reservation Status
              </span>
              <h2 className="text-base font-extrabold text-white mt-0.5">
                {reservation.status === "PENDING" && "Awaiting Payment"}
                {reservation.status === "CONFIRMED" && "Purchase Confirmed"}
                {reservation.status === "RELEASED" && "Reservation Released"}
              </h2>
            </div>
          </div>
          
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
            reservation.status === "PENDING"
              ? "bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]"
              : reservation.status === "CONFIRMED"
              ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]"
              : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
          }`}>
            {reservation.status}
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Circular Countdown Timer */}
          {isPending && (
            <div className="flex flex-col items-center py-4">
              <div className={`relative flex items-center justify-center ${shakeTimer ? "animate-shake" : ""}`}>
                {/* SVG Progress Ring */}
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    className="stroke-[#2A2A3A]"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="80"
                    cy="80"
                    r="60"
                    stroke={timerColor}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="377"
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: "linear" }}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Time Display */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-3xl font-extrabold font-mono tracking-tight ${timerTextClass}`}>
                    {formatCountdown(timeLeft)}
                  </span>
                  <span className="text-[10px] font-bold text-[#8B8B9E] uppercase tracking-wider mt-1">
                    Hold Window
                  </span>
                </div>
              </div>

              {timeLeft <= 60 && timeLeft > 0 && (
                <motion.p
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-xs text-[#EF4444] font-semibold mt-4 text-center"
                >
                  ⚠️ Hurry! Stock releases in less than a minute
                </motion.p>
              )}
            </div>
          )}

          {/* Confirmed State Graphic */}
          {reservation.status === "CONFIRMED" && (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center py-6 bg-[#22C55E]/5 border border-[#22C55E]/10 rounded-2xl p-6"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 mb-3.5">
                <CheckCircle2 className="h-6 w-6 text-[#22C55E]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Purchase Finalized</h3>
              <p className="text-sm text-[#8B8B9E] leading-relaxed max-w-sm mx-auto">
                Your checkout is complete! The stock units have been securely locked and assigned to your order.
              </p>
            </motion.div>
          )}

          {/* Released State Graphic */}
          {reservation.status === "RELEASED" && (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center py-6 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-2xl p-6"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 mb-3.5">
                <XCircle className="h-6 w-6 text-[#EF4444]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Stock Released</h3>
              <p className="text-sm text-[#8B8B9E] leading-relaxed max-w-sm mx-auto">
                This reservation has been cancelled or has expired. All units have safely returned to general warehouse stock.
              </p>
            </motion.div>
          )}

          {/* Details Card */}
          <div className="bg-[#0F0F13]/60 border border-[#2A2A3A] rounded-2xl p-5 space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-[#8B8B9E] font-bold">
              Reservation Details
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <Box className="h-5 w-5 text-[#6366F1] shrink-0" />
                <div>
                  <p className="text-xs text-[#8B8B9E] font-medium">Product</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {reservation.product?.name ?? "Unknown Product"}
                  </p>
                  <p className="text-xs text-[#8B8B9E] line-clamp-1 mt-0.5">
                    {reservation.product?.description}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Building className="h-5 w-5 text-[#6366F1] shrink-0" />
                <div>
                  <p className="text-xs text-[#8B8B9E] font-medium">Warehouse</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {reservation.warehouse?.name ?? "Unknown Warehouse"}
                  </p>
                  <p className="text-xs text-[#8B8B9E] mt-0.5">
                    {reservation.warehouse?.location}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <TrendingUp className="h-5 w-5 text-[#6366F1] shrink-0" />
                <div>
                  <p className="text-xs text-[#8B8B9E] font-medium">Quantity Reserved</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">
                    {reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Calendar className="h-5 w-5 text-[#6366F1] shrink-0" />
                <div>
                  <p className="text-xs text-[#8B8B9E] font-medium">Expires At</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {new Date(reservation.expiresAt).toLocaleTimeString()} ({new Date(reservation.expiresAt).toLocaleDateString()})
                  </p>
                </div>
              </div>
            </div>

            {/* Monospace Copyable ID */}
            <div className="pt-2 border-t border-[#2A2A3A] flex items-center justify-between gap-3 text-xs bg-[#1A1A24]/40 p-2.5 rounded-xl">
              <span className="font-mono text-[#8B8B9E] truncate">
                ID: {reservation.id}
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0F0F13] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white transition-colors"
                title="Copy Reservation ID"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                    <span className="text-[10px] font-bold text-[#22C55E]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons — only for PENDING */}
          <AnimatePresence>
            {isPending && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col sm:flex-row gap-3 pt-2"
              >
                <button
                  type="button"
                  onClick={() => handleRelease()}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#2A2A3A] bg-[#1A1A24] px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {actionLoading === "release" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Cancel Reservation
                </button>
                
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={actionLoading !== null}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {actionLoading === "confirm" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Confirm Purchase
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back button post terminal state */}
          {!isPending && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-2"
            >
              <a
                href="/"
                className="flex items-center justify-center rounded-xl border border-[#2A2A3A] bg-[#1A1A24] px-4 py-3.5 text-sm font-semibold text-white hover:bg-white/5 transition-all"
              >
                ← Browse Other Products
              </a>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
