"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Box } from "lucide-react";
import { motion } from "framer-motion";

export default function Navbar() {
  const [count, setCount] = useState(0);

  const updateCount = () => {
    try {
      const stored = localStorage.getItem("stockvault_reservations");
      if (stored) {
        const reservations = JSON.parse(stored) as { id: string; expiresAt: string }[];
        const now = Date.now();
        // Only count those that have not expired yet
        const active = reservations.filter((r) => new Date(r.expiresAt).getTime() > now);
        setCount(active.length);
      } else {
        setCount(0);
      }
    } catch (e) {
      console.error("Error reading reservations from localStorage:", e);
      setCount(0);
    }
  };

  useEffect(() => {
    updateCount();

    // Listen to custom events to update cart count in real time
    const handleStorageChange = () => updateCount();
    window.addEventListener("stockvault_reservation_change", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    // Set interval to prune expired ones from cart count
    const interval = setInterval(updateCount, 10000);

    return () => {
      window.removeEventListener("stockvault_reservation_change", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-black/40 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-colors"
            >
              <Box className="h-5 w-5 text-indigo-500" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight text-white">
              Stock<span className="text-[#6366F1]">Vault</span>
            </span>
          </a>

          {/* Nav Links */}
          <nav className="flex items-center gap-6">
            <a
              href="/"
              className="text-sm font-medium text-[#8B8B9E] transition-colors hover:text-white"
            >
              Products
            </a>

            {/* Cart Icon */}
            <a
              href={count > 0 ? `/reservations/active` : "/"}
              onClick={(e) => {
                // If there are reservations, let's redirect to the last one or have a simple behavior.
                // If we have any active reservation, redirect to it.
                try {
                  const stored = localStorage.getItem("stockvault_reservations");
                  if (stored) {
                    const reservations = JSON.parse(stored) as { id: string; expiresAt: string }[];
                    const now = Date.now();
                    const active = reservations.filter((r) => new Date(r.expiresAt).getTime() > now);
                    if (active.length > 0) {
                      e.preventDefault();
                      // Redirect to the most recent active reservation
                      window.location.href = `/reservations/${active[active.length - 1].id}`;
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="relative flex items-center justify-center p-2 rounded-full hover:bg-white/5 text-[#8B8B9E] hover:text-white transition-all"
              title={count > 0 ? `${count} active reservation(s)` : "No active reservations"}
            >
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#6366F1] text-[10px] font-bold text-white shadow-lg"
                >
                  {count}
                </motion.span>
              )}
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
