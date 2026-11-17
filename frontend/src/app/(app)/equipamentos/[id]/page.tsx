"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, Pause, Play, Trash2 } from "lucide-react";
import { MonthCalendar } from "@/components/bz/calendar";
import { TextField } from "@/components/bz/form";
import { FormError, toFormErrors, type FormErrors } from "@/components/bz/form";
import { DetailsFields, PriceFields, draftFromItem, draftToInput, validateDetails, validatePrice, type DraftErrors, type ItemDraft } from "@/components/bz/item-form";
import { isAreaNotAvailable, useLocationRequest } from "@/components/bz/location";
import { Sheet, toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { SavedPhotoGrid } from "@/components/bz/photo";
import { ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Skeleton } from "@/components/bz/ui";
import { catalogApi, ownerItemApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { compressImage } from "@/lib/images";
import { toLatLng } from "@/lib/location";
import { unavailableDays } from "@/lib/availability";
import { formatDay, formatDays, formatRange } from "@/lib/format";
import type { Availability, AvailabilityBlock, Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import { isKycRequired, kycRedirectToast } from "@/lib/kyc";

type Tab = "fotos" | "detalhes" | "preco" | "datas";

const MAX_PHOTOS = 8; // limite da API

export default function GerirEquipamentoPage() {
  const session = useRequireSession();
  const dict = useT();
  const t = dict.manageItem;
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
  const { request: requestLocation, sheet: locationSheet } = useLocationRequest({ required: true, title: dict.ownerItems.reactivateLocationTitle });

  if (!session) return null;
  if (item.error) return <ErrorState message={item.error} onRetry={item.reload} />;
  if (!item.data) return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  if (item.data.ownerId !== session.profileId) {
    return <ErrorState message={t.notYours} />;
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
      toast.success(t.saved);
    } catch (err) {
      setFormErr(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    try {
      await ownerItemApi.deactivate(id);
      toast.success(dict.ownerItems.paused);
      router.push("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : dict.ownerItems.pauseFailed);
    }
  }

  async function resume() {
    try {
      const loc = await requestLocation();
      if (!loc) return toast.error(dict.ownerItems.reactivateNeedsLocation);
      item.setData(await ownerItemApi.activate(id, toLatLng(loc)));
      toast.success(dict.ownerItems.resumed);
    } catch (e) {
      if (isAreaNotAvailable(e)) return toast.error(dict.location.areaNotAvailable);
      if (isKycRequired(e)) {
        toast(kycRedirectToast());
        router.push("/verificacao");
        return;
      }
      toast.error(e instanceof Error ? e.message : dict.ownerItems.resumeFailed);
    }
  }

  async function addPhotos(files: File[]) {
    setPhotoBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      const photos = await ownerItemApi.uploadPhotos(id, compressed);
      item.setData({ ...item.data!, photos });
      toast.success(plural(files.length, t.photoAdded));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.photosFailed);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    setPhotoBusy(true);
    try {
      const photos = await ownerItemApi.deletePhoto(id, photoId);
      item.setData({ ...item.data!, photos });
      toast.success(t.photoRemoved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.photoRemoveFailed);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await ownerItemApi.remove(id);
      toast.success(t.deleted);
      router.replace("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.deleteFailed);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href="/equipamentos">{dict.ownerItems.title}</BackLink>
      <PageHeader
        title={item.data.title}
        action={
          <ButtonLink href={`/equipamento/${id}`} variant="soft" size="sm" aria-label={t.viewListing}>
            <Eye strokeWidth={1.8} /> <span className="hidden sm:inline">{t.viewListing}</span>
          </ButtonLink>
        }
      />
      <Segmented
        label={t.sections}
        value={tab}
        onChange={setTab}
        options={[
          { value: "fotos", label: t.tabs.fotos },
          { value: "detalhes", label: t.tabs.detalhes },
          { value: "preco", label: t.tabs.preco },
          { value: "datas", label: t.tabs.datas },
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
            {t.saveChanges}
          </Button>
        </StickyCTA>
      )}

      <Card className="grid gap-3 p-4 md:p-5">
        <h2 className="font-titulo text-lg font-bold text-verde">{t.careZone}</h2>
        <div className="flex flex-wrap gap-2">
          {item.data.status === "ACTIVE" && (
            <Button variant="outline" size="sm" onClick={pause}>
              <Pause strokeWidth={1.8} /> {t.pauseListing}
            </Button>
          )}
          {item.data.status === "INACTIVE" && (
            <Button variant="outline" size="sm" onClick={resume}>
              <Play strokeWidth={1.8} /> {t.resumeListing}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 strokeWidth={1.8} /> {t.delete}
          </Button>
        </div>
      </Card>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t.deleteTitle}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {dict.common.cancel}
            </Button>
            <Button variant="danger" block loading={busy} onClick={remove}>
              {t.deleteConfirm}
            </Button>
          </div>
        }
      >
        <p className="pt-2">{t.deleteText}</p>
      </Sheet>
      {locationSheet}
    </div>
  );
}

/** Bloqueios de datas do dono: toca no primeiro e no último dia (inclusivos), nota opcional, bloquear. */
function DatesManager({ itemId }: { itemId: string }) {
  const dict = useT();
  const lang = useLang();
  const t = dict.manageItem;
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
  if (!availability.data || !blocks.data) return <Card className="p-4"><ListSkeleton rows={3} label={t.loadingDates} /></Card>;

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
      toast.success(start === end ? t.dayBlocked : t.datesBlocked);
      setSel(null);
      setNote("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.blockFailed);
    } finally {
      setBusy(false);
    }
  }

  async function unblock(b: AvailabilityBlock) {
    setRemoving(b.id);
    try {
      await ownerItemApi.deleteBlock(itemId, b.id);
      toast.success(t.unblocked);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.unblockFailed);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-4">
        <p className="text-texto-corpo">
          {t.datesHelpBefore}<strong>{t.datesHelpNot}</strong>{t.datesHelpAfter}
        </p>
        <MonthCalendar days={days} mode="owner" selection={start ? { start, end, endInclusive: true } : undefined} onDayClick={pick} />
        {start && end && (
          <div className="grid gap-3 border-t border-borda pt-4">
            <p className="font-bold text-verde">
              {start === end ? fmt(t.blockDay, { day: formatDay(start, false, lang) }) : fmt(t.blockRange, { range: formatRange(start, end, lang) })}
            </p>
            <TextField label={t.noteLabel} value={note} onChange={setNote} maxLength={200} placeholder={t.notePlaceholder} />
            {error && <Callout tone="warn">{error}</Callout>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setSel(null); setError(undefined); }}>
                {dict.common.cancel}
              </Button>
              <Button block loading={busy} onClick={block}>
                {t.blockDates}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="grid gap-3 p-4">
        <h2 className="font-titulo text-lg font-bold text-verde">{t.activeBlocks}</h2>
        {blocks.data.length === 0 ? (
          <p className="text-sm text-cinza">{t.noBlocks}</p>
        ) : (
          <ul className="grid gap-2">
            {blocks.data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-campo border border-borda p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-verde">{formatDays(b.startDate, b.endDate, lang)}</p>
                  {b.note && <p className="truncate text-[13px] text-cinza">{b.note}</p>}
                </div>
                <Button variant="outline" size="sm" loading={removing === b.id} onClick={() => unblock(b)}>
                  {t.unblock}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
