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
  sortBy: string;
  onSortChange: (value: string) => void;
  maxPrice: number;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  onClearFilters: () => void;
  showToggle?: boolean;
}

export default function Filters({
  genres,
  selectedGenre,
  onGenreChange,
  selectedCondition,
  onConditionChange,
  sortBy,
  onSortChange,
  maxPrice,
  priceRange,
  onPriceRangeChange,
  onClearFilters,
  showToggle = false,
}: FiltersProps) {
  const [open, setOpen] = useState(false);
  const hasFilters = selectedGenre || selectedCondition || priceRange[0] > 0 || priceRange[1] < maxPrice || sortBy !== "latest";

  return (
    <div className="w-full">
      {/* Mobile toggle */}
      {showToggle && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 bg-zinc-900 text-white rounded-2xl px-4 py-3 w-full justify-center"
        >
          <Filter className="w-4 h-4" />
          Filtri e ordine
          {hasFilters && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
        </button>
      )}

      <div className={`${showToggle ? (open ? "block" : "hidden") : "block"} space-y-6 ${showToggle ? "pt-4" : ""}`}>
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

        {/* Sort filter */}
        <div>
          <label htmlFor="sort-filter" className="block font-semibold text-zinc-800 mb-3">Ordina per</label>
          <select
            id="sort-filter"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm text-zinc-700 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
          >
            <option value="latest">Novita</option>
            <option value="price-asc">Prezzo crescente</option>
            <option value="price-desc">Prezzo decrescente</option>
          </select>
        </div>

        {/* Price range */}
        <div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <h4 className="font-semibold text-zinc-800">Prezzo massimo</h4>
                <p className="text-xs text-zinc-400 mt-1">Mostra solo i vinili entro la cifra selezionata</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-900 shadow-sm border border-zinc-200">
                €{priceRange[1]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxPrice}
              step={5}
              value={priceRange[1]}
              onChange={(e) => onPriceRangeChange([0, Number(e.target.value)])}
              className="w-full accent-amber-500"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
              <span>€0</span>
              <span>€{maxPrice}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
