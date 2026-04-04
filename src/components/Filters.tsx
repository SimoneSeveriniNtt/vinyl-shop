"use client";

import { Genre, CONDITIONS, CONDITION_LABELS } from "@/lib/types";
import { Filter, X } from "lucide-react";
import { useState } from "react";

interface FiltersProps {
  genres: Genre[];
  selectedGenre: string;
  onGenreChange: (genreId: string) => void;
  selectedCondition: string;
  onConditionChange: (condition: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  onClearFilters: () => void;
}

export default function Filters({
  genres,
  selectedGenre,
  onGenreChange,
  selectedCondition,
  onConditionChange,
  priceRange,
  onPriceRangeChange,
  onClearFilters,
}: FiltersProps) {
  const [open, setOpen] = useState(false);
  const hasFilters = selectedGenre || selectedCondition || priceRange[0] > 0 || priceRange[1] < 500;

  return (
    <div className="w-full">
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-700 w-full justify-center mb-4"
      >
        <Filter className="w-4 h-4" />
        Filtri
        {hasFilters && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
      </button>

      <div className={`${open ? "block" : "hidden"} md:block space-y-6`}>
        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Rimuovi filtri
          </button>
        )}

        {/* Genre filter */}
        <div>
          <label htmlFor="genre-filter" className="block font-semibold text-zinc-800 mb-3">Genere</label>
          <select
            id="genre-filter"
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm text-zinc-700 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
          >
            <option value="">Tutti i generi</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>

        {/* Condition filter */}
        <div>
          <label htmlFor="condition-filter" className="block font-semibold text-zinc-800 mb-3">Condizione</label>
          <select
            id="condition-filter"
            value={selectedCondition}
            onChange={(e) => onConditionChange(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm text-zinc-700 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
          >
            <option value="">Tutte le condizioni</option>
            {CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {CONDITION_LABELS[cond]}
              </option>
            ))}
          </select>
        </div>

        {/* Price range */}
        <div>
          <h4 className="font-semibold text-zinc-800 mb-3">Prezzo</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">€</span>
              <input
                type="number"
                min={0}
                value={priceRange[0]}
                onChange={(e) => onPriceRangeChange([Number(e.target.value), priceRange[1]])}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                placeholder="Min"
              />
              <span className="text-zinc-400">—</span>
              <input
                type="number"
                min={0}
                value={priceRange[1]}
                onChange={(e) => onPriceRangeChange([priceRange[0], Number(e.target.value)])}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
