"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { TextArea, TextField } from "./form";
import { toast } from "./overlay";
import { BackendPending, EmptyState } from "./states";
import { Button, Card } from "./ui";
import { BOOKING_LABEL, bookingCode } from "@/lib/booking";
import type { Booking } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AdminHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-6 grid gap-1">
      <h1 className="font-titulo text-[28px] font-bold tracking-tight text-verde md:text-[34px]">{title}</h1>
      <p className="max-w-2xl text-cinza">{text}</p>
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

/**
 * Ação manual por ID de reserva (o que o backend já permite ao admin).
 * Pede motivo obrigatório; o registo em audit_logs ainda não existe (BACKEND_GAPS).
 */
export function BookingActionTool({
  title, text, actionLabel, run,
}: { title: string; text: string; actionLabel: string; run: (bookingId: string) => Promise<Booking> }) {
  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!UUID.test(id.trim())) return setError("Cola o ID completo da reserva (UUID).");
    if (reason.trim().length < 5) return setError("Escreve o motivo. Fica no registo da decisão.");
    setBusy(true);
    setError(undefined);
    try {
      const b = await run(id.trim());
      setDone(b);
      toast.success(`${bookingCode(b.id)}: ${BOOKING_LABEL[b.status].label}.`);
      setId("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h2 className="font-titulo text-lg font-bold text-verde">{title}</h2>
        <p className="text-sm text-cinza">{text}</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" noValidate>
        <TextField label="ID da reserva" value={id} onChange={setId} placeholder="3f9a1c2e-…" error={error && !UUID.test(id.trim()) ? error : undefined} className="font-mono" />
        <TextArea label="Motivo (obrigatório)" value={reason} onChange={setReason} rows={1} error={error && UUID.test(id.trim()) ? error : undefined} placeholder="Ex.: comprovativo 0042… confere com o extrato" />
        <Button type="submit" variant="dark" loading={busy}>
          {actionLabel}
        </Button>
      </form>
      {done && (
        <p className="text-sm text-verde-medio">
          Última ação: {bookingCode(done.id)} · {done.itemTitle} → {BOOKING_LABEL[done.status].label}
        </p>
      )}
      <BackendPending what="O motivo ainda não é guardado (falta audit_logs)." />
    </Card>
  );
}
