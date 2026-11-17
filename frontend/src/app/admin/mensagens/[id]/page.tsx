"use client";

import { useParams } from "next/navigation";
import { RotateCw } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { CHANNEL_LABEL, DELIVERY } from "@/components/bz/admin-messages";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Badge, Button, Card, Skeleton } from "@/components/bz/ui";
import { adminMessageApi } from "@/lib/api-ops";
import { formatDateTime } from "@/lib/format";
import type { AdminMessageDetail } from "@/lib/types-ops";
import { useResource } from "@/lib/use-resource";

/** Detalhe de um envio: texto, público e o estado de cada entrega. */
export default function MensagemPage() {
  const { id } = useParams<{ id: string }>();
  const msg = useResource<AdminMessageDetail>(`admin:message:${id}`, () => adminMessageApi.get(id));

  if (msg.error) {
    return (
      <div className="grid max-w-5xl gap-4">
        <BackLink href="/admin/mensagens?tab=historico">Histórico</BackLink>
        <ErrorState message={msg.error} onRetry={msg.reload} />
      </div>
    );
  }
  if (!msg.data) return <Skeleton role="status" aria-label="A carregar envio" className="h-96 max-w-5xl rounded-sheet" />;

  const m = msg.data;
  const skipped = m.deliveries.filter((d) => d.status === "SKIPPED").length;

  return (
    <div className="grid max-w-5xl gap-5">
      <BackLink href="/admin/mensagens?tab=historico">Histórico</BackLink>
      <AdminHeader
        title={m.subject || `Mensagem por ${CHANNEL_LABEL[m.channel]}`}
        text={`${CHANNEL_LABEL[m.channel]} · ${m.audienceLabel} · ${formatDateTime(m.createdAt)} · por ${m.createdBy}`}
        action={
          <Button variant="outline" size="sm" onClick={msg.reload}>
            <RotateCw strokeWidth={1.8} aria-hidden /> Atualizar estados
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Destinatários" value={m.recipients} />
        <Count label="Enviadas" value={m.sent} />
        <Count label="Por enviar" value={m.pending} />
        <Count label="Falharam" value={m.failed} />
      </div>

      <Card className="grid gap-2 p-5">
        <h2 className="font-titulo text-lg font-bold text-verde">Texto</h2>
        <p className="text-[15px] whitespace-pre-line">{m.body ?? m.bodyPreview}</p>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <caption className="px-4 pt-4 pb-2 text-left font-titulo text-lg font-bold text-verde">
              Entregas{skipped > 0 && <span className="ml-2 text-sm font-normal text-cinza">({skipped} ignoradas por falta de contacto)</span>}
            </caption>
            <thead className="bg-areia">
              <tr>
                {["Pessoa", "Destino", "Estado", "Enviada"].map((c) => (
                  <th key={c} scope="col" className="border-b border-borda px-4 py-2 text-xs font-bold tracking-[0.1em] text-cinza uppercase">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.deliveries.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-cinza">Ainda sem entregas registadas.</td></tr>
              ) : (
                m.deliveries.map((d) => (
                  <tr key={d.userId} className="border-b border-borda align-top last:border-0">
                    <th scope="row" className="px-4 py-2 font-medium text-verde">{d.name}</th>
                    <td className="num px-4 py-2 text-cinza">{d.destinationMasked ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge tone={DELIVERY[d.status].tone}>{DELIVERY[d.status].label}</Badge>
                      {d.error && <p className="mt-1 text-[13px] text-erro">{d.error}</p>}
                    </td>
                    <td className="px-4 py-2 text-[13px] text-cinza">{d.sentAt ? formatDateTime(d.sentAt) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Card className="grid gap-0.5 p-4">
      <span className="num font-titulo text-2xl font-extrabold text-verde">{value}</span>
      <span className="text-[13px] text-cinza">{label}</span>
    </Card>
  );
}
