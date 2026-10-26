import { AdminHeader, QueueTable } from "@/components/bz/admin";
import { BackendPending } from "@/components/bz/states";

export default function AdminVerificacoes() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Verificações" text="Abre os documentos (link assinado, expira em 5 min). Aprovar, recusar ou pedir mais informação, sempre com motivo." />
      <QueueTable columns={["Pessoa", "Tipo", "Documento", "Enviado", "Estado", ""]} endpoint="GET /admin/kyc?status=PENDING" />
      <BackendPending what="KYC completo: upload privado, URLs assinadas e decisões (aprovar / recusar / pedir informação). Números de BI e NIF aparecem mascarados (•••• 4821)." />
    </div>
  );
}
