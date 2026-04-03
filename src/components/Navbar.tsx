"use client";

import Link from "next/link";
import { ShoppingCart, Disc3, Menu, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

export default function Navbar() {
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-zinc-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight hover:text-amber-400 transition-colors">
            <Disc3 className="w-7 h-7 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />
            <span>Vinyl Shop</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/catalog" className="hover:text-amber-400 transition-colors font-medium">
              Catalogo
            </Link>
            <Link href="/admin" className="hover:text-amber-400 transition-colors font-medium">
              Admin
            </Link>
            <Link href="/cart" className="relative hover:text-amber-400 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-zinc-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <Link href="/cart" className="relative hover:text-amber-400 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-zinc-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/catalog" className="block py-2 hover:text-amber-400 transition-colors" onClick={() => setMenuOpen(false)}>
              Catalogo
            </Link>
            <Link href="/admin" className="block py-2 hover:text-amber-400 transition-colors" onClick={() => setMenuOpen(false)}>
              Admin
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
