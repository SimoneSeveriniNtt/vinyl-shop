"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface CartToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function CartToast({ message, visible, onHide }: CartToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, 2200);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-live="polite"
    >
      <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
      {message}
    </div>
  );
}
