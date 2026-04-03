"use client";

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Setup carrello al primo carico
    fetch("/api/cart/setup", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log("✅ Cart system initialized");
        } else {
          console.warn("⚠️ Cart setup:", data.message);
        }
      })
      .catch(e => console.error("Cart setup error:", e));
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </CartProvider>
    </AuthProvider>
  );
}
