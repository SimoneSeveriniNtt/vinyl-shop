"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  label?: string;
  multiple?: boolean;
}

export default function ImageUpload({ onImageUploaded, label = "Carica immagine", multiple = false }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Il file deve essere un'immagine");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L'immagine non può superare 5MB");
      return;
    }

    setUploading(true);
    setError("");

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Errore upload: sessione admin non valida");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);

    const response = await fetch("/api/admin/storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.publicUrl) {
      setError("Errore upload: " + (payload?.error || "Upload non riuscito"));
      setUploading(false);
      return;
    }

    onImageUploaded(payload.publicUrl);
    setUploading(false);
  }, [onImageUploaded]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!multiple && fileArray.length > 1) {
      setError("Puoi caricare una sola immagine alla volta");
      return;
    }
    for (const file of fileArray) {
      await uploadFile(file);
    }
  }, [uploadFile, multiple]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragOver
            ? "border-amber-400 bg-amber-50"
            : "border-zinc-200 hover:border-amber-300 hover:bg-zinc-50"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-sm text-zinc-500">Caricamento in corso...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
              {multiple ? (
                <ImagePlus className="w-6 h-6 text-zinc-400" />
              ) : (
                <Upload className="w-6 h-6 text-zinc-400" />
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-amber-600">Clicca per scegliere</span>
              <span className="text-sm text-zinc-400"> o trascina qui</span>
            </div>
            <span className="text-xs text-zinc-400">PNG, JPG, WebP — max 5MB</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
