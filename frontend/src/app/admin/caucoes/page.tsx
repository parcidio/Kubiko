"use client";

import { AdminHeader, BookingActionTool, QueueTable } from "@/components/bz/admin";
import { BackendPending } from "@/components/bz/states";
import { adminApi } from "@/lib/api";

export default function AdminCaucoes() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Cauções" text="Compara as fotos da entrega e da devolução lado a lado antes de decidir." />
      <QueueTable columns={["Reserva", "Equipamento", "Devolvido em", "Caução", "Checklists", ""]} endpoint="GET /admin/deposits?status=HELD" />
      <BookingActionTool
        title="Concluir e libertar caução"
        text="Para reservas em curso, depois da inspeção. Devolve a caução ao arrendatário e conclui a reserva."
        actionLabel="Libertar caução"
        run={adminApi.complete}
      />
      <BackendPending what="Reter caução (parcial em Kz ou total, com motivo) ainda não tem endpoint." />
    </div>
  );
}
