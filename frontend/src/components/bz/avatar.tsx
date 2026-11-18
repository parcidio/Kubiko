"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { HexTile } from "./hex";
import { toast } from "./overlay";
import { Button } from "./ui";
import { profileApi } from "@/lib/api";
import { initials } from "@/lib/booking";
import { compressAvatar } from "@/lib/images";
import { useT } from "@/lib/i18n/client";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Evento global: a foto/perfil mudou (o cabeçalho atualiza sem recarregar). */
export const ME_CHANGED = "beeznoo:me";

const SIZE = {
  xs: "size-7 text-[11px]",
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl md:size-26 md:text-3xl",
} as const;

/**
 * Avatar de uma pessoa: a foto (URL assinada ou do Google) ou, sem foto, as iniciais
 * (salvia-tint + verde-médio: âmbar nunca em texto). Decorativo (aria-hidden): o nome está sempre ao lado.
 * Se a URL falhar (p. ex. assinatura expirada), volta às iniciais.
 */
export function Avatar({
  name, src, size = "md", className,
}: { name?: string | null; src?: string | null; size?: keyof typeof SIZE; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!src && failed !== src;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-salvia-tint font-titulo font-bold text-verde-medio",
        SIZE[size],
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

type Pending = { preview: string; blob: Blob } | null;

/**
 * Conta › foto de perfil: pré-visualização imediata, recorte/compressão no browser (512 px) antes de enviar,
 * estados a enviar / erro com "Tentar outra vez". Para fundos escuros (bloco verde da Conta).
 */
export function AvatarEditor({ me, onChange }: { me: Me; onChange: (me: Me) => void }) {
  const t = useT().account.avatar;
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // liberta o object URL da pré-visualização
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.preview); }, [pending]);

  const done = (next: Me) => {
    onChange(next);
    window.dispatchEvent(new CustomEvent(ME_CHANGED, { detail: next }));
  };

  async function send(blob: Blob) {
    setBusy("upload");
    setError(null);
    try {
      done(await profileApi.uploadAvatar(blob));
      setPending(null);
      toast.success(t.saved);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t.failed);
    } finally {
      setBusy(null);
    }
  }

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = ""; // permite escolher o mesmo ficheiro outra vez
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.notImage);
      return;
    }
    const blob = await compressAvatar(file);
    setPending({ preview: URL.createObjectURL(blob), blob });
    await send(blob);
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      done(await profileApi.removeAvatar());
      setPending(null);
      toast.success(t.removed);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t.failed);
    } finally {
      setBusy(null);
    }
  }

  const src = pending?.preview ?? me.avatarUrl;
  const hasPhoto = !!me.avatarUrl;

  return (
    <div className="grid justify-items-center gap-3 lg:justify-items-start">
      <div className="relative" aria-busy={busy !== null}>
        {src ? (
          <Avatar name={me.fullName} src={src} size="xl" className="ring-2 ring-salvia/40" />
        ) : (
          <>
            <HexTile tone="salvia" size={80} className="num md:hidden">{initials(me.fullName)}</HexTile>
            <HexTile tone="salvia" size={104} className="num hidden md:inline-flex">{initials(me.fullName)}</HexTile>
          </>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-verde/60">
            <span className="size-7 rounded-full border-2 border-areia/40 border-t-areia motion-safe:animate-spin" aria-hidden />
          </span>
        )}
      </div>

      <p role="status" className="sr-only">
        {busy === "upload" ? t.uploading : busy === "remove" ? t.removing : ""}
      </p>

      <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
        <input
          ref={input}
          id="avatar-file"
          type="file"
          accept="image/jpeg,image/png,image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="on-dark" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
          <Camera strokeWidth={1.8} aria-hidden /> {hasPhoto ? t.change : t.add}
        </Button>
        {hasPhoto && (
          <Button variant="on-dark" size="sm" disabled={busy !== null} loading={busy === "remove"} onClick={remove}>
            <Trash2 strokeWidth={1.8} aria-hidden /> {t.remove}
          </Button>
        )}
      </div>

      {error ? (
        <div role="alert" className="grid justify-items-center gap-2 text-sm text-salvia-tint lg:justify-items-start">
          <p>{error}</p>
          {pending && (
            <Button variant="on-dark" size="sm" disabled={busy !== null} onClick={() => send(pending.blob)}>
              {t.retry}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-salvia-tint/80">{t.hint}</p>
      )}
    </div>
  );
}
