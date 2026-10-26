import { AdminHeader, QueueTable } from "@/components/bz/admin";
import { BackendPending } from "@/components/bz/states";

export default function AdminProblemas() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Problemas reportados" text="Reservas marcadas com problema. Os detalhes chegam por WhatsApp até haver formulário no backend." />
      <QueueTable columns={["Reserva", "Tipo", "Reportado por", "Quando", "Caução", ""]} endpoint="GET /admin/incidents?status=OPEN" />
      <BackendPending what="incident_reports (tipo, descrição, fotos) e decisão da equipa (resolver, reter caução)." />
    </div>
  );
}
