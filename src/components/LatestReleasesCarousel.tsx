"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LatestVinyl {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  created_at: string;
}

export default function LatestReleasesCarousel() {
  const [vinyls, setVinyls] = useState<LatestVinyl[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchLatest() {
      const { data } = await supabase
        .from("vinyls")
        .select("id, title, artist, cover_url, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      setVinyls(data || []);
      setLoading(false);
    }

    fetchLatest();
  }, []);

  useEffect(() => {
    if (vinyls.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % vinyls.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [vinyls.length]);

  useEffect(() => {
    if (!rowRef.current) return;
    const current = rowRef.current.querySelector<HTMLAnchorElement>(`a[data-index='${activeIndex}']`);
    current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  const goPrev = () => {
    if (vinyls.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + vinyls.length) % vinyls.length);
  };

  const goNext = () => {
    if (vinyls.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % vinyls.length);
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-zinc-800/70 border border-zinc-700 p-4 flex items-center justify-center min-h-[130px]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (vinyls.length === 0) {
    return (
      <div className="rounded-2xl bg-zinc-800/70 border border-zinc-700 p-4 min-h-[130px] flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Nessuna nuova uscita disponibile</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-800/70 border border-zinc-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wider text-amber-400 uppercase">Nuove Uscite</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="w-7 h-7 rounded-full border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 flex items-center justify-center"
            aria-label="Precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-7 h-7 rounded-full border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 flex items-center justify-center"
            aria-label="Successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      >
        {vinyls.map((vinyl, i) => (
          <Link
            key={vinyl.id}
            data-index={i}
            href={`/catalog/${vinyl.id}`}
            onMouseEnter={() => setActiveIndex(i)}
            className={`snap-start shrink-0 w-28 sm:w-32 group ${i === activeIndex ? "" : "opacity-90"}`}
          >
            <div className={`aspect-square rounded-xl overflow-hidden border transition-all ${i === activeIndex ? "border-amber-400 ring-2 ring-amber-400/30" : "border-zinc-700"}`}>
              {vinyl.cover_url ? (
                <img
                  src={vinyl.cover_url}
                  alt={vinyl.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-xs">No cover</div>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-100 truncate">{vinyl.title}</p>
            <p className="text-xs text-zinc-400 truncate">{vinyl.artist}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
