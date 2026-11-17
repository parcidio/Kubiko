"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileDown, FileText } from "lucide-react";
import { Checkbox } from "@/components/bz/form";
import { HexTile } from "@/components/bz/hex";
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
import { fmt } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

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
  const lang = useLang();
  const dict = useT();
  const t = dict.contract;
  const bp = dict.bookingPage;

  if (!session) return null;
  const err = booking.error ?? contract.error;
  if (err) return <ErrorState message={err} onRetry={() => { booking.reload(); contract.reload(); }} />;
  if (!booking.data || contract.loading) {
    return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  }

  const b = booking.data;
  const c = contract.data;
  const isRenter = b.renterId === session.profileId;
  const canAccept = isRenter && b.status === "ACCEPTED" && c && !c.renterAcceptedAt;

  async function accept() {
    setBusy(true);
    try {
      contract.setData(await contractApi.accept(id));
      toast.success(t.accepted);
      router.push(`/reservas/${id}/pagar`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.acceptError);
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await documentApi.contract(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.downloadError);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>{fmt(bp.bookingCode, { code: bookingCode(id) })}</BackLink>
      <PageHeader
        title={t.title}
        subtitle={c ? fmt(t.version, { title: b.itemTitle, version: c.version }) : b.itemTitle}
        action={
          c && (
            <Button variant="soft" size="sm" loading={downloading} onClick={download} aria-label={t.downloadPdf}>
              <FileDown strokeWidth={1.8} /> <span className="hidden sm:inline">PDF</span>
            </Button>
          )
        }
      />

      {!c ? (
        <EmptyState
          icon={FileText}
          title={t.noneTitle}
          text={fmt(t.noneText, { owner: firstName(b.ownerName, dict) })}
          action={<ButtonLink href={`/reservas/${id}`} variant="outline">{bp.backToBooking}</ButtonLink>}
        />
      ) : (
        <>
          {/* quem já aceitou */}
          <Card className="grid gap-3 p-4">
            <Acceptance who={fmt(t.ownerRole, { name: b.ownerName })} at={c.ownerAcceptedAt} />
            <Acceptance who={fmt(t.renterRole, { name: b.renterName })} at={c.renterAcceptedAt} />
          </Card>

          {c.version.includes("rascunho") && (
            <Callout tone="warn" title={t.draftTitle}>
              {t.draftText}
            </Callout>
          )}

          {/* O texto vem da API, congelado e assinado (SHA-256): não se traduz no browser */}
          {lang === "en" && <p className="text-[13px] text-cinza">{t.bodyLanguage}</p>}
          <Card className="p-5 md:p-6">
            <div lang="pt-PT" className="max-h-[60vh] overflow-y-auto pr-1 text-[15px] leading-7 whitespace-pre-line text-texto-corpo" tabIndex={0} aria-label={t.bodyLabel}>
              {c.body}
            </div>
          </Card>

          <p className="text-[13px] break-all text-cinza">
            {t.fingerprint} <span className="num">{c.bodySha256}</span>
          </p>

          {canAccept && (
            <>
              <Checkbox checked={agreed} onChange={setAgreed}>
                {t.agree}
              </Checkbox>
              <StickyCTA>
                <Button block size="lg" disabled={!agreed} loading={busy} onClick={accept}>
                  {t.accept}
                </Button>
              </StickyCTA>
            </>
          )}
          {isRenter && c.renterAcceptedAt && b.status === "ACCEPTED" && (
            <ButtonLink href={`/reservas/${id}/pagar`} block size="lg">
              {t.howToPay}
            </ButtonLink>
          )}
        </>
      )}
    </div>
  );
}

function Acceptance({ who, at }: { who: string; at: string | null }) {
  const t = useT().contract;
  const lang = useLang();
  return (
    <p className="flex items-center gap-3">
      <HexTile icon={at ? CheckCircle2 : Clock} tone={at ? "salvia-tint" : "ambar-tint"} size={36} />
      <span>
        <span className="font-bold text-verde">{who}</span>
        <span className="block text-[13px] text-cinza">{at ? fmt(t.acceptedAt, { when: formatDateTime(at, lang) }) : t.notYet}</span>
      </span>
    </p>
  );
}
