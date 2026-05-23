"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  Info, 
  AlertCircle,
  TrendingUp,
  Box,
  CornerDownRight,
  Loader2
} from "lucide-react";
import { ProductWithStock, StockWithAvailability } from "@/lib/schemas";

export default function ProductListingPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    product: ProductWithStock;
    stock: StockWithAvailability;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [tickerStock, setTickerStock] = useState(0);
  const [modalShake, setModalShake] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const router = useRouter();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ProductWithStock[] = await res.json();
      setProducts(data);
      
      // Calculate total stock available across all products and warehouses for the ticker
      const total = data.reduce((acc, prod) => {
        return acc + prod.stock.reduce((sAcc, s) => sAcc + Math.max(0, s.available), 0);
      }, 0);
      setTickerStock(total);
    } catch {
      toast.error("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleReserve = async () => {
    if (!modalState) return;
    const { product, stock } = modalState;

    setReservingId(`${product.id}-${stock.warehouseId}`);
    setModalError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: stock.warehouseId,
          quantity,
        }),
      });

      if (res.status === 409) {
        setModalShake(true);
        setModalError("Not enough stock — someone just grabbed the last unit!");
        toast.error("Sorry, not enough stock available", {
          description: "Another customer just reserved this item.",
        });
        setTimeout(() => setModalShake(false), 500);
        await fetchProducts();
        return;
      }

      if (!res.ok) {
        throw new Error("Reservation failed");
      }

      const reservation = await res.json();

      // Save reservation to local storage for navbar cart count
      try {
        const existing = localStorage.getItem("stockvault_reservations");
        const list = existing ? JSON.parse(existing) : [];
        list.push({ id: reservation.id, expiresAt: reservation.expiresAt });
        localStorage.setItem("stockvault_reservations", JSON.stringify(list));
        window.dispatchEvent(new Event("stockvault_reservation_change"));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }

      toast.success("Reserved!", {
        description: "You have 10 minutes to complete checkout.",
      });
      
      setModalState(null);
      router.push(`/reservations/${reservation.id}`);
    } catch {
      toast.error("Failed to create reservation. Please try again.");
    } finally {
      setReservingId(null);
    }
  };

  const openModal = (product: ProductWithStock, stock: StockWithAvailability) => {
    setQuantity(1);
    setModalError(null);
    setModalState({ product, stock });
  };

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 bg-[#0F0F13] min-h-screen text-[#F1F1F5]">
        <div className="mb-10">
          <div className="skeleton h-12 w-80 mb-4 bg-[#1A1A24]" />
          <div className="skeleton h-6 w-96 bg-[#1A1A24]" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A24] p-5 space-y-4">
              <div className="skeleton h-44 w-full bg-[#2A2A3A]" />
              <div className="skeleton h-6 w-3/4 bg-[#2A2A3A]" />
              <div className="skeleton h-4 w-full bg-[#2A2A3A]" />
              <div className="space-y-2 pt-2">
                <div className="skeleton h-12 w-full bg-[#2A2A3A]" />
                <div className="skeleton h-12 w-full bg-[#2A2A3A]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 bg-[#0F0F13] min-h-screen text-[#F1F1F5]">
      {/* Hero Section */}
      <div className="relative mb-16 rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-[#1A1A24] to-[#0F0F13] border border-[#2A2A3A] shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4"
            >
              Reserve Before <span className="text-[#6366F1]">It&apos;s Gone</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-base sm:text-lg text-[#8B8B9E]"
            >
              Secure your units across warehouses globally. Stock is held safely for 10 minutes while you complete checkout.
            </motion.p>
          </div>
          
          {/* Stock Ticker */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4 bg-[#1E1E2F]/80 border border-[#2A2A3A] p-4 rounded-2xl backdrop-blur-md self-start md:self-auto shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <TrendingUp className="h-6 w-6 text-[#6366F1]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#8B8B9E] font-semibold">Total Stock Online</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-extrabold text-white font-mono">{tickerStock}</span>
                <span className="text-xs text-emerald-400 font-semibold">units active</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product, index) => {
          const isExpanded = expandedDescriptions[product.id] || false;
          const totalProdStock = product.stock.reduce((sum, s) => sum + Math.max(0, s.available), 0);
          
          // Generate initials for placeholder
          const initials = product.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group flex flex-col rounded-2xl border border-[#2A2A3A] bg-[#1A1A24] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
            >
              {/* Image Area */}
              <div className="relative h-44 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center border-b border-[#2A2A3A]/40 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.06),transparent_80%)]" />
                <span className="text-4xl font-extrabold bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent select-none tracking-widest">
                  {initials}
                </span>
                
                {/* Available Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-md">
                  <span className={`h-1.5 w-1.5 rounded-full ${totalProdStock > 0 ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {totalProdStock > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
              </div>

              {/* Info Area */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-[#6366F1] transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  
                  {/* Truncated / Toggleable Description */}
                  <div className="mb-4">
                    <p className={`text-sm text-[#8B8B9E] leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                      {product.description}
                    </p>
                    {product.description.length > 80 && (
                      <button
                        onClick={() => toggleDescription(product.id)}
                        className="mt-1 flex items-center gap-1 text-xs text-[#6366F1] hover:underline font-semibold"
                      >
                        {isExpanded ? (
                          <>Less <ChevronUp className="h-3 w-3" /></>
                        ) : (
                          <>More <ChevronDown className="h-3 w-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  {/* Stock Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-[#6366F1] uppercase tracking-[0.2em]">
                      Available Stock
                    </span>
                    <div className="h-[1px] bg-[#2A2A3A] flex-1" />
                  </div>

                  {/* Warehouses List */}
                  <div className="space-y-2.5">
                    {product.stock.map((stock) => {
                      const isOutOfStock = stock.available <= 0;
                      const isLowStock = stock.available > 0 && stock.available <= 10;
                      
                      // Status Dot Color Config
                      let dotColor = "bg-[#22C55E]";
                      if (isOutOfStock) dotColor = "bg-[#EF4444]";
                      else if (isLowStock) dotColor = "bg-[#F59E0B]";

                      return (
                        <div
                          key={stock.id}
                          className="flex items-center justify-between rounded-xl border border-[#2A2A3A]/40 bg-[#0F0F13]/40 px-3.5 py-2.5 hover:border-[#2A2A3A] transition-colors"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                              <p className="text-xs font-semibold text-white truncate">
                                {stock.warehouseName}
                              </p>
                            </div>
                            
                            {/* Stock status detail */}
                            <div className="mt-1 pl-4 flex items-center gap-2">
                              {isOutOfStock ? (
                                <span className="text-[10px] text-[#EF4444] font-medium bg-[#EF4444]/10 px-1.5 py-0.5 rounded">
                                  Out of stock
                                </span>
                              ) : isLowStock ? (
                                <span className="text-[10px] text-[#F59E0B] font-medium bg-[#F59E0B]/10 px-1.5 py-0.5 rounded">
                                  Only {stock.available} left!
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#8B8B9E] font-medium">
                                  {stock.available} available
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => openModal(product, stock)}
                            disabled={isOutOfStock}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                              isOutOfStock
                                ? "bg-white/5 text-[#8B8B9E]/50 cursor-not-allowed border border-[#2A2A3A]"
                                : "bg-gradient-to-r from-[#6366F1] to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white shadow-md active:scale-95 cursor-pointer"
                            }`}
                          >
                            Reserve
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {products.length === 0 && !loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 border border-[#2A2A3A] bg-[#1A1A24] rounded-3xl"
        >
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-white/5 border border-white/10">
              <Package className="h-12 w-12 text-[#8B8B9E]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No products available</h2>
          <p className="text-[#8B8B9E] max-w-sm mx-auto text-sm">
            We are fresh out of stock right now. Please seed the database or check back later!
          </p>
        </motion.div>
      )}

      {/* Reserve Modal */}
      <AnimatePresence>
        {modalState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalState(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative z-10 w-full max-w-md rounded-2xl border border-[#2A2A3A] bg-[#1A1A24] p-6 shadow-2xl overflow-hidden ${
                modalShake ? "animate-shake" : ""
              }`}
            >
              <h3 className="text-xl font-bold text-white mb-1.5 flex items-center gap-2">
                <Box className="h-5 w-5 text-[#6366F1]" />
                Confirm Reservation
              </h3>
              <p className="text-sm text-[#8B8B9E] mb-5 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#8B8B9E]" />
                {modalState.product.name} from <span className="text-white font-medium">{modalState.stock.warehouseName}</span>
              </p>

              {/* Error Alert for Concurrency Stock Issues */}
              {modalError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 flex gap-2.5 items-start bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 text-sm text-[#EF4444]"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>{modalError}</p>
                </motion.div>
              )}

              {/* Quantity Stepper */}
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest text-[#8B8B9E] font-bold mb-3">
                  Select Quantity
                </label>
                <div className="flex items-center gap-4 bg-[#0F0F13] border border-[#2A2A3A] p-2.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-white hover:bg-[#2A2A3A] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-center text-lg font-bold font-mono text-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(modalState.stock.available, q + 1))}
                    disabled={quantity >= modalState.stock.available}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-white hover:bg-[#2A2A3A] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-xs text-[#8B8B9E]">
                    Max available: <strong className="text-white">{modalState.stock.available}</strong>
                  </span>
                </div>
              </div>

              {/* Expiry / Hold Info Box */}
              <div className="flex gap-3 bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-xl p-4 mb-6 text-sm text-[#8B8B9E]">
                <Info className="h-5 w-5 text-[#6366F1] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  These units will be temporarily held for <span className="text-[#6366F1] font-semibold">10 minutes</span> to allow checkout completion. Unpaid reservations release back automatically.
                </p>
              </div>

              {/* Action CTA */}
              <div className="flex gap-3.5">
                <button
                  type="button"
                  onClick={() => setModalState(null)}
                  className="flex-1 rounded-xl border border-[#2A2A3A] bg-[#1A1A24] px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReserve}
                  disabled={reservingId !== null || modalState.stock.available <= 0}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-500 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {reservingId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Holding...
                    </>
                  ) : (
                    "Reserve Now"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
