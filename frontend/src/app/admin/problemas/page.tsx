"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Flag, ShieldCheck } from "lucide-react";
import {
  AdminBookingLink, AdminHeader, BookingEvidence, BookingStatusBadge, ConfirmWithReason, INCIDENT_LABEL, IncidentCard,
  QueueRow, QueueStates, age,
} from "@/components/bz/admin";
import { toast } from "@/components/bz/overlay";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Badge, Button, ButtonLink, Card } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import type { Incident, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

function ProblemasInner() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const queue = useResource<Page<Incident>>("admin:incidents", () => adminApi.incidents());
  const rows = queue.data?.content ?? [];
  const select = (id: string | null) => router.replace(id ? `/admin/problemas?id=${id}` : "/admin/problemas", { scroll: false });

  return (
    <div className="grid max-w-7xl gap-6">
      <AdminHeader
        title="Problemas reportados"
        text="Dano, perda, roubo ou outro, o mais antigo primeiro. Resolve com uma nota (vai para as duas partes) e depois decide a caução."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-borda bg-areia px-4 py-3">
            <p className="text-xs font-bold tracking-[0.1em] text-cinza uppercase">Por resolver</p>
            {queue.data && <p className="num text-sm font-bold text-verde">{queue.data.page?.totalElements ?? rows.length}</p>}
          </div>
          <QueueStates
            loading={!queue.data}
            error={queue.error}
            empty={rows.length === 0}
            onRetry={queue.reload}
            emptyTitle="Nenhum problema por resolver"
            emptyText="Quando alguém reporta dano, perda ou roubo, aparece aqui e recebes uma notificação."
          />
          {rows.map((i) => (
            <QueueRow
              key={i.id}
              selected={i.id === selectedId}
              onSelect={() => select(i.id)}
              title={i.itemTitle}
              badge={<Badge tone="erro">{INCIDENT_LABEL[i.type]}</Badge>}
              meta={<>{bookingCode(i.bookingId)} · por {i.reporterName} · {age(i.createdAt)}</>}
            />
          ))}
        </Card>

        <div className="lg:sticky lg:top-6">
          {selectedId ? (
            <IncidentPanel key={selectedId} id={selectedId} onResolved={queue.reload} />
          ) : (
            <Card><EmptyState icon={Flag} title="Escolhe um problema" text="Vês a descrição, as fotos, a entrega e a devolução, e resolves daqui." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminProblemas() {
  return (
    <Suspense>
      <ProblemasInner />
    </Suspense>
  );
}

function IncidentPanel({ id, onResolved }: { id: string; onResolved: () => void }) {
  // pedido próprio: as URLs das fotos expiram em 10 min, e um problema resolvido sai da fila mas continua visível aqui
  const incident = useResource<Incident>(`admin:incident:${id}`, () => adminApi.incident(id));
  const [resolving, setResolving] = useState(false);

  if (incident.error) return <Card><ErrorState message={incident.error} onRetry={incident.reload} /></Card>;
  if (!incident.data) return <Card className="p-5"><ListSkeleton rows={3} /></Card>;
  const i = incident.data;

  async function resolve(note: string) {
    incident.setData(await adminApi.resolveIncident(i.id, note));
    toast.success("Problema resolvido. As duas partes foram avisadas.");
    onResolved();
  }

  return (
    <Card className="grid gap-5 p-5">
      <div className="grid gap-1">
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-cinza">
          <AdminBookingLink bookingId={i.bookingId}>Reserva {bookingCode(i.bookingId)} <ExternalLink className="inline size-3.5" aria-hidden /></AdminBookingLink>
          <BookingStatusBadge status={i.bookingStatus} />
        </p>
        <h2 className="font-titulo text-2xl font-bold text-verde">{i.itemTitle}</h2>
      </div>

      <IncidentCard
        incident={i}
        action={
          i.status === "OPEN" ? (
            <Button variant="dark" onClick={() => setResolving(true)} className="justify-self-start">
              Resolver problema
            </Button>
          ) : (
            <ButtonLink href={`/admin/caucoes?booking=${i.bookingId}`} variant="outline" className="justify-self-start">
              <ShieldCheck strokeWidth={1.8} /> Decidir a caução desta reserva
            </ButtonLink>
          )
        }
      />

      <BookingEvidence bookingId={i.bookingId} />

      <ConfirmWithReason
        open={resolving}
        onClose={() => setResolving(false)}
        title="Resolver este problema?"
        confirmLabel="Resolver"
        reasonLabel="Nota da resolução (vai para as duas partes)"
        placeholder="Ex.: o risco já estava na foto 3 da entrega; a caução vai ser libertada."
        onConfirm={resolve}
      >
        <p>O problema sai da fila. A caução decide-se à parte, em Cauções, e só aí a reserva fica concluída.</p>
      </ConfirmWithReason>
    </Card>
  );
}
