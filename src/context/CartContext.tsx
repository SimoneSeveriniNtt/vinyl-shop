"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { CartItem, Vinyl } from "@/lib/types";

interface CartContextType {
  items: CartItem[];
  addToCart: (vinyl: Vinyl) => void;
  removeFromCart: (vinylId: string) => void;
  updateQuantity: (vinylId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  expiresInSeconds?: number;
  isExpired?: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const SESSION_ID_KEY = "vinyl-shop-session-id";
const CART_BACKUP_KEY = "vinyl-shop-cart-backup";

function generateSessionId(): string {
  return `session_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem(SESSION_ID_KEY);
    const id = stored || generateSessionId();
    if (!stored) {
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  });
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | undefined>();
  const [isExpired, setIsExpired] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Caricare il carrello dal DB (ma prima dal localStorage per velocità)
  useEffect(() => {
    if (!sessionId) return;

    async function loadCart() {
      // PRIMO: Carica dal localStorage (backup locale, istantaneo)
      const localBackup = localStorage.getItem(CART_BACKUP_KEY);
      if (localBackup) {
        try {
          const backupItems = JSON.parse(localBackup);
          setItems(backupItems);
        } catch (e) {
          console.warn("Failed to load local backup:", e);
        }
      }

      // SECONDO: Tenta di sincronizzare col DB (per authoritative data)
      try {
        const res = await fetch(`/api/cart/sync?session_id=${sessionId}`);
        const data = await res.json();

        if (data.expired) {
          setIsExpired(true);
          setItems([]);
          localStorage.removeItem(CART_BACKUP_KEY);
        } else {
          // Se il DB ha items, usa quelli; altrimenti mantieni il backup locale
          if (data.items && data.items.length > 0) {
            setItems(data.items);
          }
          setExpiresInSeconds(data.expiresInSeconds);
          setIsExpired(false);
        }
      } catch (error) {
        console.error("Failed to load cart from DB:", error);
        // Fallback: mantieni il backup locale già caricato
      }
      setLoaded(true);
    }

    loadCart();
  }, [sessionId]);

  // Salvare il backup nel localStorage SUBITO (senza debounce)
  useEffect(() => {
    if (loaded) {
      if (items.length > 0) {
        localStorage.setItem(CART_BACKUP_KEY, JSON.stringify(items));
      } else {
        localStorage.removeItem(CART_BACKUP_KEY);
      }
    }
  }, [items, loaded]);

  // Sincronizzare il carrello col DB quando cambia (con debounce)
  useEffect(() => {
    if (!loaded || !sessionId) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, items }),
      }).catch((err) => console.error("Failed to sync cart to DB:", err));
    }, 300); // Debounce veloce (300ms è abbastanza)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [items, loaded, sessionId]);

  // Timer per aggiornare il countdown della scadenza
  useEffect(() => {
    if (!loaded || expiresInSeconds === undefined) return;

    const timer = setInterval(() => {
      setExpiresInSeconds((prev) => {
        if (prev === undefined) return undefined;
        if (prev <= 1) {
          setIsExpired(true);
          setItems([]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loaded, expiresInSeconds]);

  const addToCart = (vinyl: Vinyl) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.vinyl.id === vinyl.id);
      if (existing) {
        // Each vinyl is unique stock: keep quantity fixed to 1.
        return prev;
      }
      return [...prev, { vinyl, quantity: 1 }];
    });
  };

  const removeFromCart = (vinylId: string) => {
    setItems((prev) => prev.filter((item) => item.vinyl.id !== vinylId));
  };

  const updateQuantity = (vinylId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(vinylId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.vinyl.id === vinylId ? { ...item, quantity: 1 } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.vinyl.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        expiresInSeconds,
        isExpired,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
