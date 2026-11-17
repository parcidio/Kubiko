"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FilePen, Lightbulb, Package, Pause, Pencil, Play, Plus, Search } from "lucide-react";
import { CategoryChip, ItemPhoto } from "@/components/bz/equipment";
import { HEX_CLIP, HexTile } from "@/components/bz/hex";
import { toast } from "@/components/bz/overlay";
import { ErrorState, HiveEmptyState, ListSkeleton } from "@/components/bz/states";
import { BackLink, Badge, Button, ButtonLink, Card, Kz, type Tone } from "@/components/bz/ui";
import { bookingApi, ownerItemApi } from "@/lib/api";
import { DRAFT_KEY_PREFIX, useRequireSession } from "@/lib/auth";
import { CONDITION_LABEL } from "@/lib/format";
import { isKycRequired, kycRedirectToast } from "@/lib/kyc";
import { useMode } from "@/lib/mode";
import type { ItemSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "ok" },
  INACTIVE: { label: "Pausado", tone: "neutro" },
  SUSPENDED: { label: "Em revisão", tone: "erro" },
};

type Filter = "all" | "published" | "paused" | "drafts";

/** Sem acentos nem maiúsculas, para a pesquisa ("camara" encontra "Câmara"). */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Rascunho de "Publicar": não existe na API, fica só neste browser (um por conta, publicar/page.tsx).
 * Lido no render: a página só monta com sessão no cliente, por isso não há erro de hidratação.
 */
function readDraftTitle(profileId: string): string | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}.${profileId}`);
    if (!raw) return null;
    const d = JSON.parse(raw) as { title?: string; description?: string; pricePerDay?: number | "" };
    if (!d.title?.trim() && !d.description?.trim() && !d.pricePerDay) return null;
    return d.title?.trim() || "Sem título";
  } catch {
    return null;
  }
}

export default function EquipamentosPage() {
  const session = useRequireSession();
  const router = useRouter();
  const mode = useMode(session?.role);
  const { data, error, loading, reload } = useResource(session ? "items:mine" : null, () => ownerItemApi.mine());
  // "Alugados agora" = reservas recebidas já entregues e ainda por devolver
  const received = useResource(session ? "bookings:owner" : null, () => bookingApi.received());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  if (!session) return null;
  const items = data?.content ?? [];
  const draftTitle = readDraftTitle(session.profileId);
  const rentedIds = new Set((received.data?.content ?? []).filter((b) => b.status === "IN_PROGRESS").map((b) => b.itemId));
  const published = items.filter((i) => i.status === "ACTIVE");
  const paused = items.filter((i) => i.status === "INACTIVE");
  const drafts = draftTitle ? 1 : 0;

  const q = norm(query);
  const byFilter = filter === "published" ? published : filter === "paused" ? paused : filter === "drafts" ? [] : items;
  const visible = byFilter.filter((i) => !q || norm(i.title).includes(q));
  const showDraft = !!draftTitle && (filter === "all" || filter === "drafts") && (!q || norm(draftTitle).includes(q));

  async function pause(id: string) {
    try {
      await ownerItemApi.deactivate(id);
      toast.success("Pausado. Já não aparece em Explorar.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pausar.");
    }
  }

  async function resume(id: string) {
    try {
      await ownerItemApi.activate(id);
      toast.success("Reativado. Já aparece outra vez em Explorar.");
      reload();
    } catch (e) {
      if (isKycRequired(e)) {
        toast(kycRedirectToast());
        router.push("/verificacao");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Não foi possível reativar.");
    }
  }

  const FILTERS: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todos", count: items.length + drafts },
    { value: "published", label: "Publicados", count: published.length },
    { value: "paused", label: "Pausados", count: paused.length },
    { value: "drafts", label: "Rascunhos", count: drafts },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:gap-6">
      {mode === "renter" && <BackLink href="/conta">Voltar à conta</BackLink>}

      {/* Cabeçalho âmbar com favo, contagens e hexágonos decorativos à direita */}
      <section className="superficie-ambar relative overflow-hidden rounded-sheet bg-ambar p-5 text-verde md:p-8">
        <div className="hex-bg absolute inset-0 opacity-90 mix-blend-multiply" aria-hidden />
        <span className="absolute -top-6 -right-10 hidden w-56 bg-mel/45 sm:block" style={{ aspectRatio: "1 / 1.1547", clipPath: HEX_CLIP }} aria-hidden />
        <span className="absolute -right-2 -bottom-12 hidden w-32 bg-verde sm:block md:right-44" style={{ aspectRatio: "1 / 1.1547", clipPath: HEX_CLIP }} aria-hidden />
        <div className="relative grid gap-5 sm:pr-28 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8 md:pr-56">
          <div className="flex items-center gap-4">
            <HexTile icon={Package} size={56} tone="verde" className="text-white md:hidden" />
            <HexTile icon={Package} size={76} tone="verde" className="hidden text-white md:inline-flex" />
            <div className="grid min-w-0 gap-1">
              <h1 className="font-titulo text-[26px] leading-tight font-extrabold tracking-[-0.02em] md:text-[34px]">O meu equipamento</h1>
              <p className="text-verde/85">Os teus anúncios, preços e disponibilidade.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="num inline-flex h-11 items-center gap-1.5 rounded-full bg-verde px-4 text-sm text-areia">
              <strong className="font-titulo text-xl">{loading ? "–" : items.length}</strong> {items.length === 1 ? "anúncio" : "anúncios"}
            </span>
            <span className="num inline-flex h-11 items-center gap-1.5 rounded-full bg-areia/75 px-4 text-sm text-verde backdrop-blur-sm">
              <strong className="font-titulo text-xl">{received.loading ? "–" : rentedIds.size}</strong> {rentedIds.size === 1 ? "alugado agora" : "alugados agora"}
            </span>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-cartao border border-borda bg-branco">
        {/* Filtros (deslizam no telemóvel) e pesquisa */}
        <div className="grid gap-3 border-b border-borda p-3 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:p-4">
          <div role="group" aria-label="Filtrar equipamento" className="faixa -mx-3 -my-1 min-w-0 gap-2 px-3 py-1 md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <CategoryChip key={f.value} label={f.label} count={f.count} active={filter === f.value} onClick={() => setFilter(f.value)} />
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Procurar no meu equipamento</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar"
              className="h-12 w-full rounded-campo border-[1.5px] border-borda-forte bg-branco pr-4 pl-12 text-base text-verde outline-none transition placeholder:text-cinza focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
            />
          </label>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="p-3 md:p-4"><ListSkeleton /></div>
        ) : items.length === 0 && !draftTitle ? (
          <HiveEmptyState
            icon={Package}
            satellites={[Camera, Lightbulb]}
            title="Põe o teu equipamento a render"
            text="Câmaras, lentes, luzes, colunas. Quem tem equipamento parado em Luanda ganha com ele na Beeznoo."
            action={
              <ButtonLink href="/publicar" variant="primary">
                <Plus strokeWidth={2} /> Publicar o primeiro
              </ButtonLink>
            }
          />
        ) : visible.length === 0 && !showDraft ? (
          <HiveEmptyState
            icon={Package}
            satellites={[Camera, Lightbulb]}
            title="Nada por aqui"
            text={q ? `Nenhum equipamento com "${query.trim()}".` : filter === "drafts" ? "Não tens rascunhos por acabar." : "Nenhum equipamento neste estado."}
          />
        ) : (
          <ul className="grid gap-3 p-3 md:grid-cols-2 md:p-4">
            {showDraft && (
              <li>
                <Link href="/publicar" className="levantar flex h-full animate-sobe items-center gap-3 rounded-cartao border-[1.5px] border-dashed border-borda-forte bg-areia p-3">
                  <HexTile icon={FilePen} size={48} tone="ambar-tint" className="ml-1" />
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate font-titulo text-lg leading-tight font-bold text-verde">{draftTitle}</span>
                    <span className="text-[13px] text-cinza">Rascunho neste aparelho · toca para continuar</span>
                  </span>
                  <Badge tone="pendente" className="hidden sm:inline-flex">Continuar</Badge>
                </Link>
              </li>
            )}
            {visible.map((item, i) => (
              <li key={item.id}>
                <ItemCard item={item} index={i} rented={rentedIds.has(item.id)} onPause={pause} onResume={resume} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ItemCard({
  item, index, rented, onPause, onResume,
}: { item: ItemSummary; index: number; rented: boolean; onPause: (id: string) => void; onResume: (id: string) => void }) {
  const st = STATUS[item.status] ?? { label: item.status, tone: "neutro" as Tone };
  return (
    <Card className="levantar grid h-full animate-sobe gap-3 p-3" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={`/equipamentos/${item.id}`} className="flex gap-3 rounded-campo">
        <ItemPhoto src={item.coverPhoto} alt={item.title} className="w-24 shrink-0 rounded-campo" />
        <div className="grid min-w-0 content-start gap-1">
          <p className="line-clamp-2 font-titulo text-lg leading-tight font-bold text-verde">{item.title}</p>
          <p className="text-[13px] text-cinza">{CONDITION_LABEL[item.condition]} · {item.city ?? "Luanda"}</p>
          <p className="text-verde">
            <Kz value={item.pricePerDay} className="text-lg" />
            <span className="text-[13px] text-cinza"> /dia</span>
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-3">
        <Badge tone={st.tone}>{st.label}</Badge>
        {rented && <Badge tone="escuro">Alugado agora</Badge>}
        <div className="ml-auto flex gap-2">
          {item.status === "ACTIVE" && (
            <Button variant="ghost" size="sm" onClick={() => onPause(item.id)}>
              <Pause strokeWidth={1.8} /> Pausar
            </Button>
          )}
          {item.status === "INACTIVE" && (
            <Button variant="ghost" size="sm" onClick={() => onResume(item.id)}>
              <Play strokeWidth={1.8} /> Reativar
            </Button>
          )}
          <ButtonLink href={`/equipamentos/${item.id}`} variant="soft" size="sm">
            <Pencil strokeWidth={1.8} /> Gerir
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
