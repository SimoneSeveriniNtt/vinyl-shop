export default function Footer() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm">
          © {new Date().getFullYear()} <span className="text-amber-400 font-semibold">Vinyl Shop</span>. Tutti i diritti riservati.
        </p>
        <p className="text-xs mt-2 text-zinc-500">
          La passione per la musica in vinile.
        </p>
      </div>
    </footer>
  );
}
