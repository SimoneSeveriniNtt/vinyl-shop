"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Genre, Vinyl, getConditionQuality } from "@/lib/types";
import VinylCard from "@/components/VinylCard";
import SearchBar from "@/components/SearchBar";
import Filters from "@/components/Filters";
import LatestReleasesCarousel from "@/components/LatestReleasesCarousel";
import { Loader2 } from "lucide-react";

export default function CatalogPage() {
  const [vinyls, setVinyls] = useState<Vinyl[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [maxPrice, setMaxPrice] = useState(500);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [vinylRes, genreRes] = await Promise.all([
        supabase
          .from("vinyls")
          .select("*, genres(*)")
          .eq("available", true)
          .order("created_at", { ascending: false }),
        supabase.from("genres").select("*").order("name"),
      ]);
      if (vinylRes.data) {
        setVinyls(vinylRes.data);
        const highestPrice = vinylRes.data.reduce((currentMax, vinyl) => {
          return Math.max(currentMax, Number(vinyl.price) || 0);
        }, 0);
        const nextMaxPrice = highestPrice > 0 ? Math.ceil(highestPrice / 10) * 10 : 500;
        setMaxPrice(nextMaxPrice);
        setPriceRange([0, nextMaxPrice]);
      }
      if (genreRes.data) setGenres(genreRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = vinyls.filter((v) => {
    const matchesSearch =
      !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.artist.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = !selectedGenre || v.genre_id === selectedGenre;
    const matchesCondition = !selectedCondition || getConditionQuality(v.condition) === selectedCondition;
    const matchesPrice = Number(v.price) >= priceRange[0] && Number(v.price) <= priceRange[1];
    return matchesSearch && matchesGenre && matchesCondition && matchesPrice;
  });

  const displayedVinyls = [...filtered].sort((left, right) => {
    if (sortBy === "price-asc") {
      return Number(left.price) - Number(right.price);
    }

    if (sortBy === "price-desc") {
      return Number(right.price) - Number(left.price);
    }

    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });

  const clearFilters = () => {
    setSelectedGenre("");
    setSelectedCondition("");
    setPriceRange([0, maxPrice]);
    setSortBy("latest");
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-zinc-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">Catalogo Vinili</h1>
              <p className="text-zinc-400 mb-6">Esplora la nostra collezione di dischi in vinile</p>
              <SearchBar value={search} onChange={setSearch} placeholder="Cerca per titolo o artista..." />
            </div>
            <div className="lg:col-span-6">
              <LatestReleasesCarousel />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar filters */}
          <aside className="hidden md:block w-full md:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-20">
              <Filters
                genres={genres}
                selectedGenre={selectedGenre}
                onGenreChange={setSelectedGenre}
                selectedCondition={selectedCondition}
                onConditionChange={setSelectedCondition}
                sortBy={sortBy}
                onSortChange={setSortBy}
                maxPrice={maxPrice}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                onClearFilters={clearFilters}
              />
            </div>
          </aside>

          {/* Grid */}
          <main className="flex-1">
            <div className="md:hidden mb-5">
              <div className="rounded-[28px] border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <Filters
                  genres={genres}
                  selectedGenre={selectedGenre}
                  onGenreChange={setSelectedGenre}
                  selectedCondition={selectedCondition}
                  onConditionChange={setSelectedCondition}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  maxPrice={maxPrice}
                  priceRange={priceRange}
                  onPriceRangeChange={setPriceRange}
                  onClearFilters={clearFilters}
                  showToggle
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 gap-4">
              <p className="text-zinc-500 text-sm">
                {displayedVinyls.length} {displayedVinyls.length === 1 ? "vinile trovato" : "vinili trovati"}
              </p>
              <div className="hidden md:flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm border border-zinc-200">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Ordina</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm font-medium text-zinc-700 focus:outline-none"
                >
                  <option value="latest">Novita</option>
                  <option value="price-asc">Prezzo crescente</option>
                  <option value="price-desc">Prezzo decrescente</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            ) : displayedVinyls.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-zinc-400 text-lg">Nessun vinile trovato</p>
                <button onClick={clearFilters} className="mt-4 text-amber-600 hover:text-amber-700 font-medium">
                  Rimuovi filtri
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                {displayedVinyls.map((vinyl) => (
                  <VinylCard key={vinyl.id} vinyl={vinyl} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
