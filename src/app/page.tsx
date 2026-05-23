"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const router = useRouter();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ProductWithStock[] = await res.json();
      setProducts(data);
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
        toast.error("Sorry, not enough stock available", {
          description: "Another customer may have reserved this item.",
        });
        // Refresh products to get updated stock
        await fetchProducts();
        setModalState(null);
        return;
      }

      if (!res.ok) {
        throw new Error("Reservation failed");
      }

      const reservation = await res.json();
      toast.success("Reservation created!", {
        description: "Redirecting to checkout...",
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
    setModalState({ product, stock });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="skeleton h-10 w-64 mb-3" />
          <div className="skeleton h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6">
              <div className="skeleton h-48 w-full mb-4" />
              <div className="skeleton h-6 w-3/4 mb-2" />
              <div className="skeleton h-4 w-full mb-4" />
              <div className="space-y-2">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="mb-12 animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Browse <span className="gradient-text">Products</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
          Select a product and warehouse to reserve stock. Reservations are held
          for 10 minutes during checkout.
        </p>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="card-hover rounded-2xl border border-border bg-card overflow-hidden animate-slide-up"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Product Image Area */}
            <div className="relative h-48 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)]" />
              <div className="text-6xl select-none">
                {product.name.includes("iPhone") && "📱"}
                {product.name.includes("Sony") && "🎧"}
                {product.name.includes("MacBook") && "💻"}
                {product.name.includes("Samsung") && "📲"}
                {product.name.includes("iPad") && "📱"}
              </div>
            </div>

            {/* Product Info */}
            <div className="p-5">
              <h2 className="text-lg font-semibold text-card-foreground mb-1">
                {product.name}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {product.description}
              </p>

              {/* Stock per Warehouse */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Available Stock
                </h3>
                {product.stock.map((stock) => {
                  const isOutOfStock = stock.available <= 0;
                  const isLowStock =
                    stock.available > 0 && stock.available <= 3;

                  return (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {stock.warehouseName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex h-1.5 w-1.5 rounded-full ${
                              isOutOfStock
                                ? "bg-destructive"
                                : isLowStock
                                ? "bg-warning animate-pulse"
                                : "bg-success"
                            }`}
                          />
                          <span
                            className={`text-xs ${
                              isOutOfStock
                                ? "text-destructive"
                                : isLowStock
                                ? "text-warning"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isOutOfStock
                              ? "Out of stock"
                              : isLowStock
                              ? `Only ${stock.available} left`
                              : `${stock.available} available`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => openModal(product, stock)}
                        disabled={isOutOfStock}
                        className={`ml-3 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                          isOutOfStock
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-lg shadow-primary/20"
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
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && !loading && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-semibold mb-2">No products available</h2>
          <p className="text-muted-foreground">
            Check back later or run the seed script.
          </p>
        </div>
      )}

      {/* Reservation Modal */}
      {modalState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalState(null);
          }}
        >
          <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl animate-slide-up">
            <h3 className="text-xl font-semibold mb-1">Reserve Stock</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {modalState.product.name} from {modalState.stock.warehouseName}
            </p>

            <div className="mb-6">
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                >
                  −
                </button>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  max={modalState.stock.available}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          modalState.stock.available,
                          parseInt(e.target.value) || 1
                        )
                      )
                    )
                  }
                  className="h-10 w-20 rounded-lg border border-border bg-background text-center text-foreground font-mono text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                <button
                  onClick={() =>
                    setQuantity((q) =>
                      Math.min(modalState.stock.available, q + 1)
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-muted-foreground">
                  of {modalState.stock.available}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-muted-foreground">
                  Reservation will be held for{" "}
                  <strong className="text-foreground">10 minutes</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalState(null)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReserve}
                disabled={reservingId !== null}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reservingId ? (
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
                    Reserving...
                  </span>
                ) : (
                  `Reserve ${quantity} unit${quantity > 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
