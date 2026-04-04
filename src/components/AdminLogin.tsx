"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Disc3, Loader2, Lock } from "lucide-react";

export default function AdminLoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError("Credenziali non valide. Riprova.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Disc3 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" style={{ animationDuration: "3s" }} />
          <h1 className="text-2xl font-bold text-white">Area Admin</h1>
          <p className="text-zinc-400 mt-2">Accedi per gestire il catalogo vinili</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-800 rounded-2xl p-8 shadow-xl space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:ring-2 focus:ring-amber-400 focus:outline-none focus:border-transparent"
              placeholder="admin@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:ring-2 focus:ring-amber-400 focus:outline-none focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-600 text-zinc-900 font-bold py-4 rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Accedi
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
