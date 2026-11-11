"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, ImageOff, Inbox } from "lucide-react";
import { TextArea } from "./form";
import { Sheet } from "./overlay";
import { EmptyState, ErrorState, ListSkeleton } from "./states";
import { Badge, Button, Card, type Tone } from "./ui";
import { checklistApi, incidentApi } from "@/lib/api";
import { BOOKING_LABEL } from "@/lib/booking";
import { formatDateTime } from "@/lib/format";
import type { BookingStatus, Checklist, ChecklistType, Incident, IncidentType } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="font-titulo text-[28px] font-bold tracking-tight text-verde md:text-[34px]">{title}</h1>
        <p className="max-w-2xl text-cinza">{text}</p>
      </div>
      {action}
    </div>
  );
}

/** Tabela da fila, com as colunas que a API terá de devolver. Vazia até existir o endpoint de listagem. */
export function QueueTable({ columns, endpoint }: { columns: string[]; endpoint: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="bg-areia">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <EmptyState icon={Inbox} title="Fila sem dados" text={<>Precisa de <code className="rounded bg-areia-2 px-1.5 py-0.5 text-[13px]">{endpoint}</code> para listar. Mais antigo primeiro.</>} className="py-8" />
    </Card>
  );
}

export const BOOKING_TONE: Partial<Record<BookingStatus, Tone>> = { DISPUTED: "erro", RETURNED: "pendente" };

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const st = BOOKING_LABEL[status];
  return <Badge tone={BOOKING_TONE[status] ?? st?.tone ?? "neutro"}>{st?.label ?? status}</Badge>;
}

export const INCIDENT_LABEL: Record<IncidentType, string> = { DAMAGE: "Dano", LOSS: "Perda", THEFT: "Roubo", OTHER: "Outro" };

/** "há 3 d" — idade na fila, para priorizar. */
export function age(iso: string) {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (h < 1) return "agora";
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** Linha clicável de uma fila (seleciona o item no painel ao lado). */
export function QueueRow({
  selected, onSelect, title, meta, aside, badge,
}: { selected: boolean; onSelect: () => void; title: string; meta: React.ReactNode; aside?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 border-b border-borda px-4 py-3 text-left transition last:border-0 hover:bg-areia focus-visible:bg-areia focus-visible:outline-none",
        selected && "bg-salvia-tint hover:bg-salvia-tint",
      )}
    >
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold text-verde">{title}</span>
          {badge}
        </span>
        <span className="text-[13px] text-cinza">{meta}</span>
      </span>
      {aside && <span className="shrink-0 text-right">{aside}</span>}
      <ChevronRight className="size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/** Estados da lista de uma fila: a carregar / erro / vazio. Devolve null quando há dados. */
export function QueueStates({ loading, error, empty, onRetry, emptyTitle, emptyText }: {
  loading: boolean; error?: string; empty: boolean; onRetry: () => void; emptyTitle: string; emptyText: string;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) return <div className="p-4"><ListSkeleton rows={4} /></div>;
  if (empty) return <EmptyState icon={CheckCircle2} tone="ok" title={emptyTitle} text={emptyText} />;
  return null;
}

/**
 * Decisão irreversível com motivo obrigatório (fica em audit_logs e, quando a API o envia, na notificação às partes).
 */
export function ConfirmWithReason({
  open, onClose, title, children, confirmLabel, onConfirm, danger, minReason = 5, reasonLabel = "Motivo (obrigatório)", placeholder,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  danger?: boolean;
  minReason?: number;
  reasonLabel?: string;
  placeholder?: string;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    if (reason.trim().length < minReason) return setError("Escreve o motivo. Fica no registo da decisão.");
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "dark"} block loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 pt-2">
        {children}
        <TextArea label={reasonLabel} value={reason} onChange={setReason} rows={3} maxLength={1000} error={error} placeholder={placeholder} />
      </div>
    </Sheet>
  );
}

/**
 * Provas de uma reserva para decidir: entrega e devolução lado a lado (fotos + notas) e problemas reportados.
 * As URLs das fotos expiram em 10 min: "Atualizar fotos" volta a pedi-las.
 */
export function BookingEvidence({ bookingId }: { bookingId: string }) {
  const checklists = useResource<Checklist[]>(`checklists:${bookingId}`, () => checklistApi.list(bookingId));
  const incidents = useResource<Incident[]>(`incidents:${bookingId}`, () => incidentApi.list(bookingId));
  const reload = () => {
    checklists.reload();
    incidents.reload();
  };

  if (checklists.error || incidents.error) {
    return <ErrorState message={checklists.error ?? incidents.error ?? ""} onRetry={reload} className="py-6" />;
  }
  if (!checklists.data || !incidents.data) return <ListSkeleton rows={2} label="A carregar provas" />;

  const byType = (t: ChecklistType) => checklists.data!.find((c) => c.type === t);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-titulo text-lg font-bold text-verde">Entrega e devolução</h3>
        <Button variant="ghost" size="sm" onClick={reload}>
          Atualizar fotos
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChecklistPanel title="Entrega" checklist={byType("DELIVERY")} />
        <ChecklistPanel title="Devolução" checklist={byType("RETURN")} />
      </div>

      {incidents.data.length > 0 && (
        <div className="grid gap-3">
          <h3 className="font-titulo text-lg font-bold text-verde">Problemas reportados</h3>
          {incidents.data.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistPanel({ title, checklist }: { title: string; checklist?: Checklist }) {
  if (!checklist) {
    return (
      <div className="grid min-h-32 place-items-center gap-1 rounded-cartao border border-dashed border-borda-forte p-4 text-center text-sm text-cinza">
        <ImageOff className="size-5" strokeWidth={1.8} aria-hidden />
        {title}: sem registo
      </div>
    );
  }
  return (
    <section className="grid content-start gap-2 rounded-cartao border border-borda p-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-verde">{title}</p>
        {checklist.confirmed ? (
          <Badge tone="ok" icon={CheckCircle2}>Confirmada</Badge>
        ) : (
          <Badge tone="pendente" icon={Clock}>Por confirmar</Badge>
        )}
      </div>
      <p className="text-[13px] text-cinza">
        {checklist.createdByName} · {formatDateTime(checklist.createdAt)}
      </p>
      <p className="text-[15px] whitespace-pre-line">{checklist.notes}</p>
      <PhotoStrip photos={checklist.photos} label={title} />
    </section>
  );
}

export function IncidentCard({ incident, action }: { incident: Incident; action?: React.ReactNode }) {
  return (
    <section className={cn("grid gap-2 rounded-cartao border p-3", incident.status === "OPEN" ? "border-erro/40 bg-erro-tint/40" : "border-borda")}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-4 text-erro" strokeWidth={2} aria-hidden />
        <p className="font-bold text-verde">{INCIDENT_LABEL[incident.type]}</p>
        <Badge tone={incident.status === "OPEN" ? "erro" : "neutro"}>{incident.status === "OPEN" ? "Por resolver" : "Resolvido"}</Badge>
        <span className="ml-auto text-[13px] text-cinza">
          {incident.reporterName} · {formatDateTime(incident.createdAt)}
        </span>
      </div>
      <p className="text-[15px] whitespace-pre-line">{incident.description}</p>
      {incident.photos.length > 0 && <PhotoStrip photos={incident.photos} label="Problema" />}
      {incident.resolutionNote && (
        <p className="rounded-campo bg-areia p-2 text-[13px]">
          <span className="font-bold">Resolução:</span> {incident.resolutionNote}
        </p>
      )}
      {action}
    </section>
  );
}

export function PhotoStrip({ photos, label }: { photos: { id: string; url: string; position: number }[]; label: string }) {
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {[...photos]
        .sort((a, b) => a.position - b.position)
        .map((p, i) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-campo bg-areia-2 focus-visible:ring-4 focus-visible:ring-verde-medio/25 focus-visible:outline-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${label}: foto ${i + 1}`} className="size-full object-cover" loading="lazy" />
          </a>
        ))}
    </div>
  );
}

export function AdminBookingLink({ bookingId, children }: { bookingId: string; children: React.ReactNode }) {
  return (
    <Link href={`/admin/reservas/${bookingId}`} className="font-medium text-verde underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
