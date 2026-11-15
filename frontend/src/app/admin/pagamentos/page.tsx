"use client";

import { useState } from "react";
import { AdminBookingLink, AdminHeader, ConfirmWithReason, QueueStates, age } from "@/components/bz/admin";
import { toast } from "@/components/bz/overlay";
import { Badge, Button, Card, Kz } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import { formatDateTime, formatKz } from "@/lib/format";
import { CHANNEL_LABEL, type AdminPayment, type CommissionDue, type Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/**
 * Pagamento direto ao dono (decisoes-produto.md 2026-11-15): a Beeznoo não recebe o aluguer. Aqui a equipa vê
 * os pagamentos que os donos confirmaram e regista as comissões (taxa de serviço) que recebe deles.
 */
export default function AdminPagamentos() {
  const commissions = useResource<CommissionDue[]>("admin:commissions", () => adminApi.commissions());
  const payments = useResource<Page<AdminPayment>>("admin:payments", () => adminApi.payments());
  const due = commissions.data ?? [];
  const rows = payments.data?.content ?? [];
  const [selected, setSelected] = useState<CommissionDue | null>(null);

  async function settle(reason: string) {
    if (!selected) return;
    const r = await adminApi.settleCommissions(selected.ownerId, reason);
    toast.success(`${selected.ownerName}: ${formatKz(r.amount)} registados (${r.payments} ${r.payments === 1 ? "pagamento" : "pagamentos"}).`);
    commissions.reload();
    payments.reload();
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <AdminHeader
        title="Pagamentos e comissões"
        text="O arrendatário paga ao dono na entrega e o dono confirma na app. A taxa de serviço fica como dívida do dono até a equipa a receber."
      />

      <Card className="overflow-hidden">
        <h2 className="border-b border-borda bg-areia px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">Comissões por receber</h2>
        <QueueStates
          loading={!commissions.data}
          error={commissions.error}
          empty={due.length === 0}
          onRetry={commissions.reload}
          emptyTitle="Nenhuma comissão em dívida"
          emptyText="Quando um dono confirma um pagamento, a taxa de serviço aparece aqui até a registares como recebida."
        />
        {due.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="bg-areia">
                <tr>
                  {["Dono", "Pagamentos", "Em dívida", "Mais antiga", ""].map((c) => (
                    <th key={c} scope="col" className="border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {due.map((c) => (
                  <tr key={c.ownerId} className="border-b border-borda align-middle last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-verde">{c.ownerName}</p>
                      <a href={`tel:${c.ownerPhone}`} className="num text-[13px] text-mel-texto hover:underline">{c.ownerPhone}</a>
                    </td>
                    <td className="num px-4 py-3">{c.payments}</td>
                    <td className="px-4 py-3"><Kz value={c.amount} className="text-verde" /></td>
                    <td className="px-4 py-3 text-[13px]">{age(c.oldestConfirmedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="dark" size="sm" onClick={() => setSelected(c)}>
                        Registar recebida
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-borda bg-areia px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">Pagamentos confirmados</h2>
        <QueueStates
          loading={!payments.data}
          error={payments.error}
          empty={rows.length === 0}
          onRetry={payments.reload}
          emptyTitle="Ainda sem pagamentos"
          emptyText="Aparecem aqui quando um dono confirma que recebeu na entrega."
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[15px]">
              <thead className="bg-areia">
                <tr>
                  {["Reserva", "Arrendatário → dono", "Meio", "Montante", "Taxa", "Confirmado"].map((c) => (
                    <th key={c} scope="col" className="border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="entra-cascata">
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-borda align-middle last:border-0">
                    <td className="px-4 py-3">
                      <AdminBookingLink bookingId={p.bookingId}>{bookingCode(p.bookingId)}</AdminBookingLink>
                      <p className="text-[13px] text-cinza">{p.itemTitle}</p>
                    </td>
                    <td className="px-4 py-3">{p.renterName} → {p.ownerName}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {p.channel ? CHANNEL_LABEL[p.channel] : p.method === "REFERENCE" ? "Referência" : "Validado pela equipa"}
                      {p.receiptNumber && <p className="num text-cinza">{p.receiptNumber}</p>}
                    </td>
                    <td className="px-4 py-3"><Kz value={p.amount} className="text-verde" /></td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className="num">{formatKz(p.serviceFee)}</span>
                      <div className="mt-1">
                        {p.method !== "DIRECT" ? null : p.commissionSettledAt ? <Badge tone="ok">Recebida</Badge> : <Badge tone="pendente">Em dívida</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{p.confirmedAt ? formatDateTime(p.confirmedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmWithReason
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Registar comissão recebida?"
        confirmLabel="Sim, registar"
        placeholder="Ex.: transferência de 2.400 Kz recebida a 15/11, ref. 0042 1234."
        onConfirm={settle}
      >
        {selected && (
          <p>
            Confirmas que recebeste <span className="font-bold">{formatKz(selected.amount)}</span> de {selected.ownerName}, a taxa de serviço de{" "}
            {selected.payments} {selected.payments === 1 ? "pagamento" : "pagamentos"}. Fica na auditoria e sai da Carteira do dono.
          </p>
        )}
      </ConfirmWithReason>
    </div>
  );
}
