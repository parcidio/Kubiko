"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileDown, FileText } from "lucide-react";
import { Checkbox } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Callout, Card, Skeleton } from "@/components/bz/ui";
import { ApiError, bookingApi, contractApi, documentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode, firstName } from "@/lib/booking";
import { formatDateTime } from "@/lib/format";
import type { Booking, Contract } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/**
 * Contrato congelado da reserva (texto, versão e SHA-256 vêm da API). O dono aceitou ao aceitar o pedido;
 * o arrendatário aceita aqui antes de pagar (a API recusa a referência sem esta aceitação).
 */
export default function ContratoPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  // 409 = o dono ainda não aceitou: ainda não há contrato (estado vazio, não erro)
  const contract = useResource<Contract | null>(session ? `contract:${id}` : null, () =>
    contractApi.get(id).catch((e) => (e instanceof ApiError && e.status === 409 ? null : Promise.reject(e))),
  );
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!session) return null;
  const err = booking.error ?? contract.error;
  if (err) return <ErrorState message={err} onRetry={() => { booking.reload(); contract.reload(); }} />;
  if (!booking.data || contract.loading) {
    return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  }

  const b = booking.data;
  const c = contract.data;
  const isRenter = b.renterId === session.profileId;
  const canAccept = isRenter && b.status === "ACCEPTED" && c && !c.renterAcceptedAt;

  async function accept() {
    setBusy(true);
    try {
      contract.setData(await contractApi.accept(id));
      toast.success("Contrato aceite.");
      router.push(`/reservas/${id}/pagar`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aceitar o contrato.");
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await documentApi.contract(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível descarregar o contrato.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      <PageHeader
        title="Contrato de aluguer"
        subtitle={c ? `${b.itemTitle} · versão ${c.version}` : b.itemTitle}
        action={
          c && (
            <Button variant="soft" size="sm" loading={downloading} onClick={download} aria-label="Descarregar PDF">
              <FileDown strokeWidth={1.8} /> <span className="hidden sm:inline">PDF</span>
            </Button>
          )
        }
      />

      {!c ? (
        <EmptyState
          icon={FileText}
          title="Ainda não há contrato"
          text={`O contrato é gerado quando ${firstName(b.ownerName)} aceitar o pedido. Avisamos-te.`}
          action={<ButtonLink href={`/reservas/${id}`} variant="outline">Voltar à reserva</ButtonLink>}
        />
      ) : (
        <>
          {/* quem já aceitou */}
          <Card className="grid gap-3 p-4">
            <Acceptance who={`${b.ownerName} (dono)`} at={c.ownerAcceptedAt} />
            <Acceptance who={`${b.renterName} (arrendatário)`} at={c.renterAcceptedAt} />
          </Card>

          {c.version.includes("rascunho") && (
            <Callout tone="warn" title="Texto em revisão jurídica">
              Esta versão ainda pode mudar antes de a Beeznoo abrir ao público. O que aceitas fica guardado tal como está aqui.
            </Callout>
          )}

          <Card className="p-5 md:p-6">
            <div className="max-h-[60vh] overflow-y-auto pr-1 text-[15px] leading-7 whitespace-pre-line text-texto-corpo" tabIndex={0} aria-label="Texto do contrato">
              {c.body}
            </div>
          </Card>

          <p className="text-[13px] break-all text-cinza">
            Impressão digital do texto (SHA-256): <span className="num">{c.bodySha256}</span>
          </p>

          {canAccept && (
            <>
              <Checkbox checked={agreed} onChange={setAgreed}>
                Li o contrato e aceito as condições. Sei que a caução fica retida até à devolução e inspeção do equipamento.
              </Checkbox>
              <StickyCTA>
                <Button block size="lg" disabled={!agreed} loading={busy} onClick={accept}>
                  Aceitar e ir para o pagamento
                </Button>
              </StickyCTA>
            </>
          )}
          {isRenter && c.renterAcceptedAt && b.status === "ACCEPTED" && (
            <ButtonLink href={`/reservas/${id}/pagar`} block size="lg">
              Ir para o pagamento
            </ButtonLink>
          )}
        </>
      )}
    </div>
  );
}

function Acceptance({ who, at }: { who: string; at: string | null }) {
  return (
    <p className="flex items-start gap-3">
      {at ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
      ) : (
        <Clock className="mt-0.5 size-5 shrink-0 text-mel-texto" strokeWidth={1.8} aria-hidden />
      )}
      <span>
        <span className="font-bold text-verde">{who}</span>
        <span className="block text-[13px] text-cinza">{at ? `Aceitou em ${formatDateTime(at)}` : "Ainda não aceitou"}</span>
      </span>
    </p>
  );
}
