"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, Flag, Sun } from "lucide-react";
import { CameraSlot } from "@/components/bz/photo";
import { TextArea } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Skeleton } from "@/components/bz/ui";
import { bookingApi, checklistApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode, firstName } from "@/lib/booking";
import { formatDateTime } from "@/lib/format";
import { compressImage } from "@/lib/images";
import type { Booking, Checklist, ChecklistType } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

// Ângulos pedidos; rótulos e dicas em t.checklist.angles
const ANGLES = (["frente", "tras", "lados", "serie", "acessorios", "detalhe"] as const).map((key) => ({ key }));
const MIN_PHOTOS = 2; // mínimo da API (máx. 10)


/** Fase atual a partir do estado da reserva: entrega em ACTIVE, devolução em IN_PROGRESS, senão só histórico. */
function phaseOf(status: Booking["status"]): ChecklistType | null {
  if (status === "ACTIVE") return "DELIVERY";
  if (status === "IN_PROGRESS") return "RETURN";
  return null;
}

export default function ChecklistPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const lists = useResource<Checklist[]>(session ? `checklists:${id}` : null, () => checklistApi.list(id));
  const dict = useT();
  const t = dict.checklist;

  if (!session) return null;
  const err = booking.error ?? lists.error;
  if (err) return <Dark><ErrorState message={err} onRetry={() => { booking.reload(); lists.reload(); }} /></Dark>;
  if (!booking.data || !lists.data) {
    return (
      <Dark>
        <div role="status" aria-label={dict.common.loading} className="grid gap-4">
          <Skeleton className="h-10 w-2/3 bg-white/10" />
          <Skeleton className="h-64 bg-white/10" />
        </div>
      </Dark>
    );
  }

  const b = booking.data;
  const me = session.profileId;
  const other = b.renterId === me ? b.ownerName : b.renterName;
  const phase = phaseOf(b.status);
  const current = phase ? lists.data.find((c) => c.type === phase) : undefined;
  const history = lists.data.filter((c) => c.type !== phase || c.confirmed);

  // depois de confirmar, a reserva muda de estado: recarregar as duas coisas
  const refresh = () => {
    booking.reload();
    lists.reload();
  };

  return (
    <Dark>
      <div className="[&_a]:text-salvia">
        <BackLink href={`/reservas/${id}`}>{fmt(dict.bookingPage.bookingCode, { code: bookingCode(id) })}</BackLink>
      </div>
      <div className="grid gap-2">
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-white md:text-[32px]">
          {phase ? t[phase].title : t.both}
        </h1>
        <p className="text-[15px] text-salvia-tint">
          {phase ? fmt(t.introPhase, { other: firstName(other, dict) }) : t.introHistory}
        </p>
      </div>

      {phase && !current && <CaptureForm bookingId={id} type={phase} onDone={refresh} />}
      {phase && current && !current.confirmed && (
        current.createdById === me ? (
          <Waiting checklist={current} other={other} />
        ) : (
          <Review bookingId={id} checklist={current} onDone={refresh} />
        )
      )}

      {history.length > 0 && (
        <div className="grid gap-4">
          {phase && <h2 className="font-titulo text-xl font-bold text-white">{t.alreadyRecorded}</h2>}
          {history.map((c) => (
            <ChecklistView key={c.id} checklist={c} />
          ))}
        </div>
      )}
      {!phase && history.length === 0 && <p className="text-areia/75">{t.nothingYet}</p>}
    </Dark>
  );
}

// Ecrã escuro, como uma câmara: melhor contraste ao fotografar
function Dark({ children }: { children: React.ReactNode }) {
  return (
    <div className="superficie-marca -mx-4 -mt-5 min-h-[calc(100dvh-4rem)] bg-verde-noite px-4 pt-5 pb-28 text-areia md:mx-0 md:mt-0 md:rounded-sheet md:p-8">
      <div className="mx-auto grid max-w-3xl gap-6">{children}</div>
    </div>
  );
}

function CaptureForm({ bookingId, type, onDone }: { bookingId: string; type: ChecklistType; onDone: () => void }) {
  const [files, setFiles] = useState<Record<string, { file: File; url: string }>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT().checklist;
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const done = ANGLES.filter((a) => files[a.key]).length;
  const ready = done >= MIN_PHOTOS && notes.trim().length > 0;

  function pick(key: string, file: File) {
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setFiles((f) => ({ ...f, [key]: { file, url } }));
  }

  async function submit() {
    setBusy(true);
    try {
      const photos = await Promise.all(ANGLES.filter((a) => files[a.key]).map((a) => compressImage(files[a.key].file)));
      await checklistApi.create(bookingId, type, notes.trim(), photos);
      toast.success(t[type].done);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.registerError);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">
            {fmt(t.photosCount, { done, total: ANGLES.length })} {done < MIN_PHOTOS && <span className="font-normal text-areia/70">{fmt(t.minimum, { min: MIN_PHOTOS })}</span>}
          </span>
          <span className="flex items-center gap-1.5 text-areia/70">
            <Sun className="size-4 text-ambar" strokeWidth={1.8} aria-hidden /> {t.light}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={t.photosTaken} aria-valuemin={0} aria-valuemax={ANGLES.length} aria-valuenow={done}>
          <div
            className="h-full origin-left rounded-full bg-salvia transition-transform duration-350 ease-out"
            style={{ transform: `scaleX(${done / ANGLES.length})` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {ANGLES.map((a) => (
          <CameraSlot key={a.key} label={t.angles[a.key].label} hint={t.angles[a.key].hint} photo={files[a.key]?.url} onPick={(f) => pick(a.key, f)} />
        ))}
      </div>

      <div className="rounded-cartao bg-white/5 p-4 [&_label]:text-areia [&_textarea]:border-white/20 [&_textarea]:bg-white/5 [&_textarea]:text-areia">
        <TextArea
          label={t.notes}
          value={notes}
          onChange={setNotes}
          rows={3}
          maxLength={2000}
          placeholder={t.notesPh}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-verde-noite px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button size="lg" block disabled={!ready} loading={busy} onClick={submit}>
          {done < MIN_PHOTOS ? plural(MIN_PHOTOS - done, t.missing) : !notes.trim() ? t.writeNotes : t[type].verb}
        </Button>
      </div>
    </>
  );
}

function Waiting({ checklist, other }: { checklist: Checklist; other: string }) {
  const dict = useT();
  const t = dict.checklist;
  const name = firstName(other, dict);
  return (
    <>
      <div className="flex gap-3 rounded-cartao border border-white/15 p-4" role="status">
        <Clock className="mt-0.5 size-5 shrink-0 text-ambar" strokeWidth={1.8} aria-hidden />
        <p>
          <span className="font-bold">{fmt(t.waitingFor, { name })}</span>{" "}
          <span className="text-areia/75">{fmt(t.waitingText, { noun: t[checklist.type].noun, name })}</span>
        </p>
      </div>
      <ChecklistView checklist={checklist} />
    </>
  );
}

function Review({ bookingId, checklist, onDone }: { bookingId: string; checklist: Checklist; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const dict = useT();
  const t = dict.checklist;
  const noun = t[checklist.type].noun;

  async function confirm() {
    setBusy(true);
    try {
      await checklistApi.confirm(bookingId, checklist.type);
      toast.success(checklist.type === "DELIVERY" ? t.deliveryConfirmed : t.returnConfirmed);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.confirmError);
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-areia/85">
        <span className="font-bold">{firstName(checklist.createdByName, dict)}</span> {fmt(t.reviewText, { noun })}
      </p>
      <ChecklistView checklist={checklist} />
      <div className="grid gap-3">
        <Button size="lg" block loading={busy} onClick={confirm}>
          {fmt(t.confirm, { noun })}
        </Button>
        <ButtonLink href={`/reservas/${bookingId}/problema`} variant="outline" block className="border-white/30 text-areia hover:bg-white/10">
          <Flag strokeWidth={1.8} /> {t.disagree}
        </ButtonLink>
      </div>
    </>
  );
}

function ChecklistView({ checklist }: { checklist: Checklist }) {
  const t = useT().checklist;
  const lang = useLang();
  const noun = t[checklist.type].noun;
  return (
    <section className="grid animate-sobe gap-3 rounded-cartao border border-white/10 bg-white/5 p-4" aria-label={fmt(t.viewLabel, { noun })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-titulo text-lg font-bold text-white capitalize">{noun}</h3>
        {checklist.confirmed ? (
          <span className="flex items-center gap-1.5 text-sm text-salvia">
            <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden /> {checklist.confirmedAt ? fmt(t.confirmedAt, { when: formatDateTime(checklist.confirmedAt, lang) }) : t.confirmed}
          </span>
        ) : (
          <span className="text-sm text-areia/70">{t.pending}</span>
        )}
      </div>
      <p className="text-[13px] text-areia/70">
        {fmt(t.createdBy, { name: checklist.createdByName, when: formatDateTime(checklist.createdAt, lang) })}
      </p>
      <p className="whitespace-pre-line">{checklist.notes}</p>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {[...checklist.photos]
          .sort((a, b) => a.position - b.position)
          .map((p, i) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-campo bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={fmt(t.photoOf, { n: i + 1, noun })} className="size-full object-cover" />
            </a>
          ))}
      </div>
    </section>
  );
}
