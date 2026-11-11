"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, Pause, Play, Trash2 } from "lucide-react";
import { MonthCalendar } from "@/components/bz/calendar";
import { TextField } from "@/components/bz/form";
import { FormError, toFormErrors, type FormErrors } from "@/components/bz/form";
import { DetailsFields, PriceFields, draftFromItem, draftToInput, validateDetails, validatePrice, type DraftErrors, type ItemDraft } from "@/components/bz/item-form";
import { Sheet, toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { SavedPhotoGrid } from "@/components/bz/photo";
import { ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Skeleton } from "@/components/bz/ui";
import { catalogApi, ownerItemApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { compressImage } from "@/lib/images";
import { unavailableDays } from "@/lib/availability";
import { formatDay, formatDays, formatRange } from "@/lib/format";
import type { Availability, AvailabilityBlock, Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Tab = "fotos" | "detalhes" | "preco" | "datas";

const MAX_PHOTOS = 8; // limite da API

export default function GerirEquipamentoPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const item = useResource<Item>(session ? `item:${id}` : null, () => catalogApi.item(id));
  const [tab, setTab] = useState<Tab>("detalhes");
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formErr, setFormErr] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!session) return null;
  if (item.error) return <ErrorState message={item.error} onRetry={item.reload} />;
  if (!item.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  if (item.data.ownerId !== session.profileId) {
    return <ErrorState message="Este equipamento não é teu." />;
  }

  const d = draft ?? draftFromItem(item.data);
  const set = (patch: Partial<ItemDraft>) => setDraft({ ...d, ...patch });

  async function save() {
    const e = { ...validateDetails(d), ...validatePrice(d) };
    setErrors(e);
    if (Object.keys(e).length) {
      setTab(e.title || e.categoryId || e.city ? "detalhes" : "preco");
      return;
    }
    setBusy(true);
    setFormErr({ fields: {} });
    try {
      item.setData(await ownerItemApi.update(id, draftToInput(d)));
      setDraft(null);
      toast.success("Alterações guardadas.");
    } catch (err) {
      setFormErr(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    try {
      await ownerItemApi.deactivate(id);
      toast.success("Pausado. Já não aparece em Explorar.");
      router.push("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pausar.");
    }
  }

  async function resume() {
    try {
      item.setData(await ownerItemApi.activate(id));
      toast.success("Reativado. Já aparece outra vez em Explorar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reativar.");
    }
  }

  async function addPhotos(files: File[]) {
    setPhotoBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      const photos = await ownerItemApi.uploadPhotos(id, compressed);
      item.setData({ ...item.data!, photos });
      toast.success(files.length === 1 ? "Foto adicionada." : `${files.length} fotos adicionadas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar as fotos.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    setPhotoBusy(true);
    try {
      const photos = await ownerItemApi.deletePhoto(id, photoId);
      item.setData({ ...item.data!, photos });
      toast.success("Foto removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover a foto.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await ownerItemApi.remove(id);
      toast.success("Equipamento eliminado.");
      router.replace("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível eliminar.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href="/equipamentos">O meu equipamento</BackLink>
      <PageHeader
        title={item.data.title}
        action={
          <ButtonLink href={`/equipamento/${id}`} variant="soft" size="sm" aria-label="Ver anúncio">
            <Eye strokeWidth={1.8} /> <span className="hidden sm:inline">Ver anúncio</span>
          </ButtonLink>
        }
      />
      <Segmented
        label="Secções"
        value={tab}
        onChange={setTab}
        options={[
          { value: "fotos", label: "Fotos" },
          { value: "detalhes", label: "Detalhes" },
          { value: "preco", label: "Preço" },
          { value: "datas", label: "Datas" },
        ]}
      />
      <div key={tab} className="animate-sobe">
        {tab === "fotos" && (
          <SavedPhotoGrid photos={item.data.photos} max={MAX_PHOTOS} busy={photoBusy} onAdd={addPhotos} onRemove={removePhoto} />
        )}
        {tab === "detalhes" && <DetailsFields draft={d} set={set} errors={errors} categories={categories} />}
        {tab === "preco" && <PriceFields draft={d} set={set} errors={errors} />}
        {tab === "datas" && <DatesManager itemId={id} />}
      </div>
      <FormError message={formErr.form ?? Object.values(formErr.fields)[0]} />

      {(tab === "detalhes" || tab === "preco") && (
        <StickyCTA>
          <Button block size="lg" loading={busy} disabled={!draft} onClick={save}>
            Guardar alterações
          </Button>
        </StickyCTA>
      )}

      <Card className="grid gap-2 p-4">
        <p className="font-bold text-verde">Zona de cuidado</p>
        <div className="flex flex-wrap gap-2">
          {item.data.status === "ACTIVE" && (
            <Button variant="outline" size="sm" onClick={pause}>
              <Pause strokeWidth={1.8} /> Pausar anúncio
            </Button>
          )}
          {item.data.status === "INACTIVE" && (
            <Button variant="outline" size="sm" onClick={resume}>
              <Play strokeWidth={1.8} /> Reativar anúncio
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 strokeWidth={1.8} /> Eliminar
          </Button>
        </div>
      </Card>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar equipamento?"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" block loading={busy} onClick={remove}>
              Sim, eliminar
            </Button>
          </div>
        }
      >
        <p className="pt-2">Deixa de aparecer em Explorar e não podes receber novos pedidos. Os alugueres já feitos ficam no histórico.</p>
      </Sheet>
    </div>
  );
}

/** Bloqueios de datas do dono: toca no primeiro e no último dia (inclusivos), nota opcional, bloquear. */
function DatesManager({ itemId }: { itemId: string }) {
  const availability = useResource<Availability>(`availability:${itemId}`, () => catalogApi.availability(itemId));
  const blocks = useResource<AvailabilityBlock[]>(`blocks:${itemId}`, () => ownerItemApi.blocks(itemId));
  const [sel, setSel] = useState<{ start: string; end?: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const reload = () => {
    availability.reload();
    blocks.reload();
  };
  if (availability.error || blocks.error) {
    return <Card><ErrorState message={availability.error ?? blocks.error ?? ""} onRetry={reload} /></Card>;
  }
  if (!availability.data || !blocks.data) return <Card className="p-4"><ListSkeleton rows={3} label="A carregar datas" /></Card>;

  const days = unavailableDays(availability.data);
  const start = sel?.start;
  const end = sel?.end ?? sel?.start;

  // 1.º toque: início; 2.º toque: fim (ou novo início, se for antes). Um toque só = um dia.
  function pick(day: string) {
    setError(undefined);
    if (!sel || sel.end || day < sel.start) setSel({ start: day });
    else setSel({ start: sel.start, end: day });
  }

  async function block() {
    if (!start || !end) return;
    setBusy(true);
    setError(undefined);
    try {
      await ownerItemApi.createBlock(itemId, { startDate: start, endDate: end, note: note.trim() || undefined });
      toast.success(start === end ? "Dia bloqueado." : "Datas bloqueadas.");
      setSel(null);
      setNote("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível bloquear.");
    } finally {
      setBusy(false);
    }
  }

  async function unblock(b: AvailabilityBlock) {
    setRemoving(b.id);
    try {
      await ownerItemApi.deleteBlock(itemId, b.id);
      toast.success("Datas desbloqueadas.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desbloquear.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-4">
        <p className="text-texto-corpo">
          Toca no primeiro e no último dia em que o equipamento <strong>não</strong> está disponível. Os dias com reserva já estão marcados.
        </p>
        <MonthCalendar days={days} mode="owner" selection={start ? { start, end, endInclusive: true } : undefined} onDayClick={pick} />
        {start && end && (
          <div className="grid gap-3 border-t border-borda pt-4">
            <p className="font-bold text-verde">
              {start === end ? `Bloquear ${formatDay(start)}` : `Bloquear de ${formatRange(start, end)}`}
            </p>
            <TextField label="Nota (opcional, só tu vês)" value={note} onChange={setNote} maxLength={200} placeholder="Ex.: viagem, uso próprio, alugado fora da app" />
            {error && <Callout tone="warn">{error}</Callout>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setSel(null); setError(undefined); }}>
                Cancelar
              </Button>
              <Button block loading={busy} onClick={block}>
                Bloquear datas
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="grid gap-3 p-4">
        <p className="font-bold text-verde">Bloqueios ativos</p>
        {blocks.data.length === 0 ? (
          <p className="text-sm text-cinza">Sem datas bloqueadas. Quem procura vê o equipamento livre fora das reservas.</p>
        ) : (
          <ul className="grid gap-2">
            {blocks.data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-campo border border-borda p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-verde">{formatDays(b.startDate, b.endDate)}</p>
                  {b.note && <p className="truncate text-[13px] text-cinza">{b.note}</p>}
                </div>
                <Button variant="outline" size="sm" loading={removing === b.id} onClick={() => unblock(b)}>
                  Desbloquear
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
