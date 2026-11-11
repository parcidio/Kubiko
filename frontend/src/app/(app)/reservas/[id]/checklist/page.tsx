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

const ANGLES = [
  { key: "frente", label: "Frente", hint: "Equipamento inteiro, de frente" },
  { key: "tras", label: "Traseira", hint: "Ecrã e botões visíveis" },
  { key: "lados", label: "Lados", hint: "Portas e encaixes" },
  { key: "serie", label: "Número de série", hint: "Etiqueta legível" },
  { key: "acessorios", label: "Acessórios", hint: "Bateria, carregador, mala" },
  { key: "detalhe", label: "Marcas existentes", hint: "Riscos ou desgaste já existentes" },
];
const MIN_PHOTOS = 2; // mínimo da API (máx. 10)

const LABEL: Record<ChecklistType, { noun: string; verb: string }> = {
  DELIVERY: { noun: "entrega", verb: "Registar entrega" },
  RETURN: { noun: "devolução", verb: "Registar devolução" },
};

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

  if (!session) return null;
  const err = booking.error ?? lists.error;
  if (err) return <Dark><ErrorState message={err} onRetry={() => { booking.reload(); lists.reload(); }} /></Dark>;
  if (!booking.data || !lists.data) {
    return (
      <Dark>
        <div role="status" aria-label="A carregar" className="grid gap-4">
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
      <div className="[&_a]:text-ambar">
        <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      </div>
      <div className="grid gap-2">
        <h1 className="font-titulo text-[30px] leading-tight font-extrabold">
          {phase ? `Checklist de ${LABEL[phase].noun}` : "Entrega e devolução"}
        </h1>
        <p className="text-areia/75">
          {phase
            ? `Um de vocês fotografa e descreve o estado; ${firstName(other)} confirma. As fotos são a prova do estado do equipamento.`
            : "Registo das fotos e notas da entrega e da devolução desta reserva."}
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
          {phase && <h2 className="font-titulo text-xl font-bold">Já registado</h2>}
          {history.map((c) => (
            <ChecklistView key={c.id} checklist={c} />
          ))}
        </div>
      )}
      {!phase && history.length === 0 && <p className="text-areia/75">Ainda não há nada registado.</p>}
    </Dark>
  );
}

// Ecrã escuro, como uma câmara: melhor contraste ao fotografar
function Dark({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -mt-5 min-h-[calc(100dvh-4rem)] bg-verde-noite px-4 pt-5 pb-28 text-areia md:mx-0 md:mt-0 md:rounded-sheet md:p-8">
      <div className="mx-auto grid max-w-3xl gap-6">{children}</div>
    </div>
  );
}

function CaptureForm({ bookingId, type, onDone }: { bookingId: string; type: ChecklistType; onDone: () => void }) {
  const [files, setFiles] = useState<Record<string, { file: File; url: string }>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
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
      toast.success(`${LABEL[type].noun[0].toUpperCase()}${LABEL[type].noun.slice(1)} registada. Falta a outra parte confirmar.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">
            {done} de {ANGLES.length} fotos {done < MIN_PHOTOS && <span className="font-normal text-areia/70">(mínimo {MIN_PHOTOS})</span>}
          </span>
          <span className="flex items-center gap-1.5 text-areia/70">
            <Sun className="size-4 text-ambar" strokeWidth={1.8} aria-hidden /> Procura boa luz, sem flash
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-ambar transition-all" style={{ width: `${(done / ANGLES.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {ANGLES.map((a) => (
          <CameraSlot key={a.key} label={a.label} hint={a.hint} photo={files[a.key]?.url} onPick={(f) => pick(a.key, f)} />
        ))}
      </div>

      <div className="rounded-cartao bg-white/5 p-4 [&_label]:text-areia [&_textarea]:border-white/20 [&_textarea]:bg-white/5 [&_textarea]:text-areia">
        <TextArea
          label="Notas sobre o estado"
          value={notes}
          onChange={setNotes}
          rows={3}
          maxLength={2000}
          placeholder="Ex.: pequeno risco no canto inferior do ecrã, já existia. 2 baterias e carregador."
        />
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-white/10 bg-verde-noite px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button size="lg" block disabled={!ready} loading={busy} onClick={submit}>
          {done < MIN_PHOTOS ? `Faltam ${MIN_PHOTOS - done} fotos` : !notes.trim() ? "Escreve as notas" : LABEL[type].verb}
        </Button>
      </div>
    </>
  );
}

function Waiting({ checklist, other }: { checklist: Checklist; other: string }) {
  return (
    <>
      <div className="flex gap-3 rounded-cartao border border-white/15 p-4" role="status">
        <Clock className="mt-0.5 size-5 shrink-0 text-ambar" strokeWidth={1.8} aria-hidden />
        <p>
          <span className="font-bold">À espera de {firstName(other)}.</span>{" "}
          <span className="text-areia/75">Registaste a {LABEL[checklist.type].noun}; {firstName(other)} tem de confirmar na app dele.</span>
        </p>
      </div>
      <ChecklistView checklist={checklist} />
    </>
  );
}

function Review({ bookingId, checklist, onDone }: { bookingId: string; checklist: Checklist; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const noun = LABEL[checklist.type].noun;

  async function confirm() {
    setBusy(true);
    try {
      await checklistApi.confirm(bookingId, checklist.type);
      toast.success(checklist.type === "DELIVERY" ? "Entrega confirmada. Bom aluguer!" : "Devolução confirmada. A equipa vai decidir a caução.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível confirmar.");
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-areia/85">
        <span className="font-bold">{firstName(checklist.createdByName)}</span> registou a {noun}. Confere as fotos e as notas com o equipamento à tua frente.
      </p>
      <ChecklistView checklist={checklist} />
      <div className="grid gap-3">
        <Button size="lg" block loading={busy} onClick={confirm}>
          Confirmar {noun}
        </Button>
        <ButtonLink href={`/reservas/${bookingId}/problema`} variant="outline" block className="border-white/30 text-areia hover:bg-white/10">
          <Flag strokeWidth={1.8} /> Não concordo: reportar problema
        </ButtonLink>
      </div>
    </>
  );
}

function ChecklistView({ checklist }: { checklist: Checklist }) {
  const noun = LABEL[checklist.type].noun;
  return (
    <section className="grid gap-3 rounded-cartao bg-white/5 p-4" aria-label={`Checklist de ${noun}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-titulo text-lg font-bold capitalize">{noun}</h3>
        {checklist.confirmed ? (
          <span className="flex items-center gap-1.5 text-sm text-salvia">
            <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden /> Confirmada {checklist.confirmedAt && `em ${formatDateTime(checklist.confirmedAt)}`}
          </span>
        ) : (
          <span className="text-sm text-areia/70">Por confirmar</span>
        )}
      </div>
      <p className="text-[13px] text-areia/70">
        Registada por {checklist.createdByName} em {formatDateTime(checklist.createdAt)}
      </p>
      <p className="whitespace-pre-line">{checklist.notes}</p>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {[...checklist.photos]
          .sort((a, b) => a.position - b.position)
          .map((p, i) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-campo bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Foto ${i + 1} da ${noun}`} className="size-full object-cover" />
            </a>
          ))}
      </div>
    </section>
  );
}
