"use client";

import { AdminHeader, BookingActionTool, QueueTable } from "@/components/bz/admin";
import { adminApi } from "@/lib/api";

export default function AdminPagamentos() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Pagamentos a validar" text="Compara o comprovativo e o ID da transação com o extrato. Só depois validas." />
      <QueueTable columns={["Reserva", "Arrendatário", "Esperado", "Indicado", "ID transação", "Enviado", ""]} endpoint="GET /admin/payments?status=REVIEW" />
      <BookingActionTool
        title="Validar pagamento manualmente"
        text="Para reservas aceites (por pagar). Liquida o pagamento no ledger e passa a reserva a paga."
        actionLabel="Validar pagamento"
        run={adminApi.confirmPayment}
      />
    </div>
  );
}
