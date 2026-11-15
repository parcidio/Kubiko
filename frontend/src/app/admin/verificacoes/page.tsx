"use client";

import { useState } from "react";
import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { AdminHeader, ConfirmWithReason, QueueStates, age } from "@/components/bz/admin";
import { toast } from "@/components/bz/overlay";
import { ErrorState } from "@/components/bz/states";
import { Badge, Button, Card, Skeleton } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { KycDetail, KycDocumentType, KycQueueItem, KycStatus, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const DOC_LABEL: Record<KycDocumentType, string> = {
  BI_FRONT: "BI — frente",
  BI_BACK: "BI — verso",
  SELFIE: "Selfie com o BI",
  NIF_DOCUMENT: "Documento do NIF",
  BUSINESS_DOCUMENT: "Certidão ou alvará",
};

const DOC_ORDER: KycDocumentType[] = ["BI_FRONT", "BI_BACK", "SELFIE", "NIF_DOCUMENT", "BUSINESS_DOCUMENT"];

const STATUS: Record<KycStatus, { label: string; tone: "pendente" | "ok" | "erro" | "neutro" }> = {
  PENDING: { label: "Por abrir", tone: "pendente" },
  IN_REVIEW: { label: "Em análise", tone: "pendente" },
  APPROVED: { label: "Aprovada", tone: "ok" },
  REJECTED: { label: "Recusada", tone: "erro" },
  INFO_REQUESTED: { label: "Info pedida", tone: "neutro" },
};

const ACTION_LABEL: Record<string, string> = {
  START_REVIEW: "Abriu a análise",
  APPROVE: "Aprovou",
  REJECT: "Recusou",
  REQUEST_INFO: "Pediu informação",
  RESUBMIT: "Reenviou documentos",
};

type Decision = "APPROVE" | "REJECT" | "REQUEST_INFO";

/**
 * KYC manual (decisoes-produto.md 2026-11-15): a pessoa envia o BI e a selfie, a equipa confere e decide.
 * Abrir uma verificação fica na auditoria (KYC_DOCUMENTS_VIEWED); os links dos documentos expiram em 5 min.
 */
export default function AdminVerificacoes() {
  const queue = useResource<Page<KycQueueItem>>("admin:kyc", () => adminApi.kycQueue());
  const rows = queue.data?.content ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KycDetail | null>(null);
  const [detailError, setDetailError] = useState<string>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  async function open(item: KycQueueItem) {
    setOpenId(item.id);
    setDetail(null);
    setDetailError(undefined);
    setLoadingDetail(true);
    try {
      // abrir = começar a análise: as outras pessoas da equipa veem que já há alguém nesta
      // se outra pessoa da equipa já a abriu (409), segue para o detalhe na mesma
      if (item.status === "PENDING") await adminApi.kycReview(item.id, "START_REVIEW").catch(() => undefined);
      setDetail(await adminApi.kycDetail(item.id));
      if (item.status === "PENDING") queue.reload();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Não foi possível abrir a verificação.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function decide(note: string) {
    if (!openId || !decision) return;
    await adminApi.kycReview(openId, decision, note || undefined);
    toast.success(decision === "APPROVE" ? "Identidade aprovada." : decision === "REJECT" ? "Verificação recusada." : "Pedido de informação enviado.");
    setOpenId(null);
    setDetail(null);
    queue.reload();
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <AdminHeader
        title="Verificações"
        text="BI e selfie por conferir, a mais antiga primeiro. Confere que a cara, o nome e o BI batem certo. Recusar e pedir informação exigem motivo, que a pessoa vê."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Card className="overflow-hidden">
          <QueueStates
            loading={!queue.data}
            error={queue.error}
            empty={rows.length === 0}
            onRetry={queue.reload}
            emptyTitle="Nenhuma verificação pendente"
            emptyText="Quando alguém envia o BI, aparece aqui."
          />
          {rows.length > 0 && (
            <ul>
              {rows.map((k) => (
                <li key={k.id} className="border-b border-borda last:border-0">
                  <button
                    type="button"
                    onClick={() => open(k)}
                    className={cn("flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-areia", openId === k.id && "bg-areia")}
                  >
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-medium text-verde">{k.profileName}</span>
                      <span className="text-[13px] text-cinza">
                        {k.accountType === "BUSINESS" ? "Empresa" : "Particular"} · enviado {age(k.submittedAt)}
                      </span>
                    </span>
                    <Badge tone={STATUS[k.status].tone}>{STATUS[k.status].label}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="grid gap-4 p-5">
          {!openId ? (
            <p className="text-cinza">Escolhe uma verificação para ver os documentos.</p>
          ) : detailError ? (
            <ErrorState message={detailError} onRetry={() => { const k = rows.find((r) => r.id === openId); if (k) open(k); }} />
          ) : loadingDetail || !detail ? (
            <div role="status" aria-label="A carregar" className="grid gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-56 rounded-cartao" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-titulo text-xl font-bold text-verde">{detail.profileName}</h2>
                  <p className="text-[13px] text-cinza">
                    {detail.verification.accountType === "BUSINESS" ? "Empresa" : "Particular"}
                    {detail.verification.submittedAt && ` · enviado a ${formatDateTime(detail.verification.submittedAt)}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { const k = rows.find((r) => r.id === openId); if (k) open(k); }}>
                  <RefreshCw strokeWidth={1.8} /> Renovar links
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[...detail.documents].sort((a, b) => DOC_ORDER.indexOf(a.documentType) - DOC_ORDER.indexOf(b.documentType)).map((d) => (
                  <figure key={d.id} className="grid gap-1.5">
                    {d.contentType === "application/pdf" ? (
                      <a
                        href={d.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex aspect-[4/3] items-center justify-center gap-2 rounded-cartao border border-borda bg-areia font-medium text-verde hover:border-borda-forte"
                      >
                        <FileText className="size-6 text-mel" strokeWidth={1.8} aria-hidden /> Abrir PDF
                      </a>
                    ) : (
                      <a href={d.signedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-cartao border border-borda bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.signedUrl} alt={DOC_LABEL[d.documentType]} className="aspect-[4/3] w-full object-contain" />
                      </a>
                    )}
                    <figcaption className="flex items-center justify-between text-[13px] text-cinza">
                      <span className="font-medium text-verde">{DOC_LABEL[d.documentType]}</span>
                      <span className="flex items-center gap-1">
                        {formatDateTime(d.uploadedAt)} <ExternalLink className="size-3.5" aria-hidden />
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="text-[13px] text-cinza">Os links expiram em 5 minutos. Não descarregues nem partilhes os documentos fora do portal.</p>

              {detail.decisions.length > 0 && (
                <div className="grid gap-1.5 border-t border-borda pt-3">
                  <p className="text-xs font-bold tracking-[0.1em] text-cinza uppercase">Histórico</p>
                  {detail.decisions.map((d) => (
                    <p key={d.id} className="text-[13px]">
                      <span className="font-medium text-verde">{ACTION_LABEL[d.action] ?? d.action}</span> · {d.actorName} · {formatDateTime(d.createdAt)}
                      {d.note && <span className="block text-cinza">{d.note}</span>}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 border-t border-borda pt-4">
                <Button variant="dark" onClick={() => setDecision("APPROVE")}>Aprovar</Button>
                <Button variant="outline" onClick={() => setDecision("REQUEST_INFO")}>Pedir informação</Button>
                <Button variant="danger" onClick={() => setDecision("REJECT")}>Recusar</Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmWithReason
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision === "APPROVE" ? "Aprovar esta identidade?" : decision === "REJECT" ? "Recusar esta verificação?" : "Pedir mais informação?"}
        confirmLabel={decision === "APPROVE" ? "Sim, aprovar" : decision === "REJECT" ? "Recusar" : "Enviar pedido"}
        danger={decision === "REJECT"}
        minReason={decision === "APPROVE" ? 0 : 5}
        reasonLabel={decision === "APPROVE" ? "Nota interna (opcional)" : "Motivo (a pessoa vê este texto)"}
        placeholder={
          decision === "APPROVE"
            ? "Ex.: BI e selfie conferidos."
            : decision === "REJECT"
              ? "Ex.: o nome no BI não corresponde ao da conta."
              : "Ex.: a foto do verso do BI está desfocada. Envia outra, com luz."
        }
        onConfirm={decide}
      >
        {detail && (
          <p>
            {decision === "APPROVE"
              ? `${detail.profileName} passa a poder pedir reservas e publicar, com o selo "Verificado".`
              : decision === "REJECT"
                ? `${detail.profileName} é avisado com o motivo e pode enviar documentos novos.`
                : `${detail.profileName} é avisado do que falta e reenvia os documentos.`}
          </p>
        )}
      </ConfirmWithReason>
    </div>
  );
}
