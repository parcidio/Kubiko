"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Check, ImagePlus, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LocalPhoto = { id: string; file: File; url: string };

/** Pré-visualizações locais (object URLs) libertadas quando saem do ecrã. */
export function useLocalPhotos(max = 10) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const all = useRef<string[]>([]);
  useEffect(() => () => all.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const add = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => {
        const url = URL.createObjectURL(file);
        all.current.push(url);
        return { id: url, file, url };
      });
    setPhotos((p) => [...p, ...next].slice(0, max));
  };
  const remove = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id));
  const makeCover = (id: string) => setPhotos((p) => [...p.filter((x) => x.id === id), ...p.filter((x) => x.id !== id)]);
  return { photos, add, remove, makeCover };
}

/** Grelha de fotos com capa. A primeira foto é a capa. */
export function PhotoPicker({
  photos, onAdd, onRemove, onCover, min = 3,
}: {
  photos: LocalPhoto[];
  onAdd: (f: FileList | null) => void;
  onRemove: (id: string) => void;
  onCover: (id: string) => void;
  min?: number;
}) {
  const id = useId();
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {photos.map((p, i) => (
          <figure key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-campo bg-areia-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {i === 0 ? (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-verde px-2 py-0.5 text-[11px] font-bold tracking-wider text-ambar uppercase">Capa</span>
            ) : (
              <button type="button" onClick={() => onCover(p.id)} className="absolute bottom-1.5 left-1.5 rounded-full bg-branco/90 px-2 py-0.5 text-[11px] font-bold text-verde">
                Pôr capa
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label={`Remover foto ${i + 1}`}
              className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-verde/80 text-areia"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </figure>
        ))}
        <label
          htmlFor={id}
          className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-campo border-2 border-dashed border-borda-forte bg-branco text-center text-[13px] font-medium text-verde transition hover:border-verde has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-verde-medio/25"
        >
          <ImagePlus className="size-6 text-mel" strokeWidth={1.8} aria-hidden />
          Adicionar
          <input id={id} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onAdd(e.target.files)} />
        </label>
      </div>
      <p className={cn("text-[13px]", photos.length >= min ? "text-verde-medio" : "text-cinza")}>
        {photos.length >= min ? <Check className="mr-1 inline size-4" strokeWidth={2} aria-hidden /> : null}
        {photos.length} de pelo menos {min} fotos. Frente, traseira e acessórios ajudam a alugar mais depressa.
      </p>
    </div>
  );
}

/** Um ângulo da checklist: abre a câmara traseira no telemóvel. */
export function CameraSlot({
  label, hint, photo, onPick,
}: { label: string; hint: string; photo?: string; onPick: (f: File) => void }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-cartao text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ambar/40",
        photo ? "bg-black" : "border-2 border-dashed border-white/25 bg-white/5 text-areia hover:border-ambar",
      )}
    >
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={label} className="absolute inset-0 size-full object-cover" />
          <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-verde-medio text-branco">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2 text-left text-[13px] font-bold text-branco">
            {label}
            <RotateCw className="size-4" strokeWidth={2} aria-label="Repetir" />
          </span>
        </>
      ) : (
        <>
          <Camera className="size-7 text-ambar" strokeWidth={1.6} aria-hidden />
          <span className="text-sm font-bold">{label}</span>
          <span className="px-3 text-[12px] text-areia/70">{hint}</span>
        </>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </label>
  );
}

export type SavedPhoto = { id: string; photUrl: string; position: number };

/**
 * Fotos já guardadas de um equipamento (Gerir equipamento). Adicionar e remover falam logo com a API;
 * a primeira foto é a capa. `busy` desativa a grelha enquanto há um pedido a decorrer.
 */
export function SavedPhotoGrid({
  photos, max, busy, onAdd, onRemove,
}: {
  photos: SavedPhoto[];
  max: number;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (photoId: string) => void;
}) {
  const id = useId();
  const sorted = [...photos].sort((a, b) => a.position - b.position);
  const room = max - sorted.length;
  return (
    <div className="grid gap-3" aria-busy={busy || undefined}>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {sorted.map((p, i) => (
          <figure key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-campo bg-areia-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photUrl} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-verde px-2 py-0.5 text-[11px] font-bold tracking-wider text-ambar uppercase">Capa</span>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(p.id)}
              aria-label={`Remover foto ${i + 1}`}
              className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-areia disabled:opacity-50"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-verde/80">
                <X className="size-4" strokeWidth={2} />
              </span>
            </button>
          </figure>
        ))}
        {room > 0 && (
          <label
            htmlFor={id}
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-campo border-2 border-dashed border-borda-forte bg-branco text-center text-[13px] font-medium text-verde transition hover:border-verde has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-verde-medio/25",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <ImagePlus className="size-6 text-mel" strokeWidth={1.8} aria-hidden />
            {busy ? "A enviar…" : "Adicionar"}
            <input
              id={id}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, room);
                e.target.value = "";
                if (files.length) onAdd(files);
              }}
            />
          </label>
        )}
      </div>
      <p className="text-[13px] text-cinza">
        {sorted.length} de {max} fotos. JPEG ou PNG; comprimimos antes de enviar.
      </p>
    </div>
  );
}
