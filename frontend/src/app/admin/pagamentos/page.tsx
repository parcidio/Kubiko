"use client";

import { useState } from "react";
import { AdminBookingLink, AdminHeader, ConfirmWithReason, QueueStates, age } from "@/components/bz/admin";
import { toast } from "@/components/bz/overlay";
import { Badge, Button, Card, Kz } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import { formatDateTime, formatKz } from "@/lib/format";
import type { AdminPayment, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/**
 * Referências Multicaixa em aberto, a mais antiga primeiro. Validar = confirmar que o montante entrou no extrato.
 * O envio de comprovativo pelo arrendatário ainda não existe (BACKEND_GAPS #5): compara com o extrato da conta.
 */
export default function AdminPagamentos() {
  const queue = useResource<Page<AdminPayment>>("admin:payments", () => adminApi.payments());
  const rows = queue.data?.content ?? [];
  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const [now] = useState(() => Date.now()); // instante fixo por visita: o render tem de ser puro

  async function confirm(reason: string) {
    if (!selected) return;
    await adminApi.confirmPayment(selected.bookingId, reason);
    toast.success(`${bookingCode(selected.bookingId)}: pagamento validado, reserva paga.`);
    queue.reload();
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <AdminHeader
        title="Pagamentos a validar"
        text="Referências por pagar, a mais antiga primeiro. Só validas depois de veres o montante exato no extrato da conta Multicaixa."
      />
      <Card className="overflow-hidden">
        <QueueStates
          loading={!queue.data}
          error={queue.error}
          empty={rows.length === 0}
          onRetry={queue.reload}
          emptyTitle="Nenhuma referência em aberto"
          emptyText="Quando um arrendatário gera uma referência, aparece aqui até ser paga ou expirar."
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead className="bg-areia">
                <tr>
                  {["Reserva", "Arrendatário", "Entidade / referência", "Montante", "Validade", ""].map((c) => (
                    <th key={c} scope="col" className="border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const expired = new Date(p.expiresAt).getTime() < now;
                  return (
                    <tr key={p.id} className="border-b border-borda align-middle last:border-0">
                      <td className="px-4 py-3">
                        <AdminBookingLink bookingId={p.bookingId}>{bookingCode(p.bookingId)}</AdminBookingLink>
                        <p className="text-[13px] text-cinza">{p.itemTitle}</p>
                      </td>
                      <td className="px-4 py-3">{p.renterName}</td>
                      <td className="num px-4 py-3">
                        {p.entity ?? "—"} / {(p.reference ?? "—").replace(/(\d{3})(?=\d)/g, "$1 ")}
                      </td>
                      <td className="px-4 py-3"><Kz value={p.amount} className="text-verde" /></td>
                      <td className="px-4 py-3 text-[13px]">
                        {expired ? <Badge tone="erro">Expirada</Badge> : formatDateTime(p.expiresAt)}
                        <p className="text-cinza">gerada {age(p.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="dark" size="sm" onClick={() => setSelected(p)}>
                          Validar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmWithReason
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Validar este pagamento?"
        confirmLabel="Sim, validar"
        placeholder="Ex.: 437.480 Kz no extrato de 15/10, ref. 123 456 789."
        onConfirm={confirm}
      >
        {selected && (
          <p>
            Confirmas que entraram <span className="font-bold">{formatKz(selected.amount)}</span> de {selected.renterName} para a reserva{" "}
            {bookingCode(selected.bookingId)}. A reserva passa a paga, a caução fica retida e o comprovativo é emitido.
          </p>
        )}
      </ConfirmWithReason>
    </div>
  );
}
