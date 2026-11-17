"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, HelpCircle, MessageCircle, PackageX, ShieldAlert, Wrench } from "lucide-react";
import { FormError, RadioCards, TextArea, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PhotoPicker, useLocalPhotos } from "@/components/bz/photo";
import { PageHeader } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { SuccessCheck } from "@/components/bz/success";
import { BackLink, Button, ButtonLink, Callout, Skeleton, buttonClass } from "@/components/bz/ui";
import { bookingApi, incidentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { compressImage } from "@/lib/images";
import { bookingCode, whatsappLink } from "@/lib/booking";
import type { Booking, IncidentType } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

type Kind = "dano" | "perda" | "roubo" | "outro";
const KIND_API: Record<Kind, IncidentType> = { dano: "DAMAGE", perda: "LOSS", roubo: "THEFT", outro: "OTHER" };

export default function ProblemaPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const [kind, setKind] = useState<Kind>("dano");
  const [text, setText] = useState("");
  const photos = useLocalPhotos(6);
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const dict = useT();
  const t = dict.problem;
  const bp = dict.bookingPage;

  if (!session) return null;
  if (booking.error) return <ErrorState message={booking.error} onRetry={booking.reload} />;
  if (!booking.data) return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  const b = booking.data;
  const code = bookingCode(b.id);

  async function submit() {
    if (text.trim().length < 10) return setErrors({ fields: { text: t.describe } });
    setBusy(true);
    setErrors({ fields: {} });
    try {
      const files = await Promise.all(photos.photos.map((p) => compressImage(p.file)));
      await incidentApi.report(b.id, KIND_API[kind], text.trim(), files);
      toast.success(t.reported);
      setSent(true);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    const wa = whatsappLink(fmt(t.waText, { code, title: b.itemTitle, kind: t.kinds[kind].title }));
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <SuccessCheck />
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde md:text-[32px]">{t.sentTitle}</h1>
        <p className="text-cinza">{t.sentText}</p>
        <ButtonLink href={`/reservas/${b.id}`} block size="lg">
          {bp.backToBooking}
        </ButtonLink>
        <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("ghost", "md")}>
          <MessageCircle strokeWidth={1.8} /> {t.urgent}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>{fmt(bp.bookingCode, { code })}</BackLink>
      <PageHeader title={t.title} subtitle={fmt(t.subtitle, { title: b.itemTitle })} />

      {b.status === "COMPLETED" && b.renterId === session?.profileId && (
        <Callout tone="info" icon={HelpCircle} title={t.depositTitle}>
          {t.depositText}
        </Callout>
      )}
      {!["ACTIVE", "IN_PROGRESS", "RETURNED", "DISPUTED", "COMPLETED"].includes(b.status) ? (
        <Callout tone="info" icon={HelpCircle} title={t.onlyDuringTitle}>
          {t.onlyDuringText}
        </Callout>
      ) : (
        <>
          <RadioCards<Kind>
            legend={t.what}
            name="kind"
            value={kind}
            onChange={setKind}
            columns={2}
            options={[
              { value: "dano", ...t.kinds.dano, icon: Wrench },
              { value: "perda", ...t.kinds.perda, icon: PackageX },
              { value: "roubo", ...t.kinds.roubo, icon: ShieldAlert },
              { value: "outro", ...t.kinds.outro, icon: HelpCircle },
            ]}
          />
          <TextArea label={t.tell} value={text} onChange={setText} rows={5} maxLength={2000} error={errors.fields.text} placeholder={t.tellPh} />
          <div className="grid gap-2">
            <p className="text-sm font-medium text-verde">{t.photos}</p>
            <PhotoPicker photos={photos.photos} onAdd={photos.add} onRemove={photos.remove} onCover={photos.makeCover} min={1} />
          </div>
          <Callout tone="warn" icon={AlertTriangle}>
            {t.theft}
          </Callout>
          <FormError message={errors.form} />
          <Button variant="dark" size="lg" block loading={busy} onClick={submit}>
            {t.submit}
          </Button>
          <p className="text-center text-[13px] text-cinza">
            {t.footnote}
          </p>
        </>
      )}
    </div>
  );
}
