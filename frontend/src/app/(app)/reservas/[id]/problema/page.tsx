"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, HelpCircle, MessageCircle, PackageX, ShieldAlert, Wrench } from "lucide-react";
import { HexIllustration } from "@/components/bz/brand";
import { FormError, RadioCards, TextArea, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PhotoPicker, useLocalPhotos } from "@/components/bz/photo";
import { PageHeader } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Callout, Skeleton, buttonClass } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode, whatsappLink } from "@/lib/booking";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Kind = "dano" | "perda" | "roubo" | "outro";
const KIND_LABEL: Record<Kind, string> = { dano: "Dano", perda: "Perda", roubo: "Roubo", outro: "Outro" };

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

  if (!session) return null;
  if (booking.error) return <ErrorState message={booking.error} onRetry={booking.reload} />;
  if (!booking.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  const b = booking.data;
  const code = bookingCode(b.id);

  async function submit() {
    if (text.trim().length < 10) return setErrors({ fields: { text: "Descreve o que aconteceu (pelo menos uma frase)." } });
    setBusy(true);
    setErrors({ fields: {} });
    try {
      await bookingApi.dispute(b.id);
      toast.success("Problema reportado. A equipa vai analisar.");
      setSent(true);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    // Descrição e fotos ainda não têm endpoint: seguem para a equipa por WhatsApp.
    const wa = whatsappLink(`Reportar problema — reserva ${code} (${b.itemTitle}).\nTipo: ${KIND_LABEL[kind]}\n${text.trim()}\n(Envio ${photos.photos.length} foto(s) a seguir.)`);
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={ShieldAlert} tone="ambar" size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">Problema reportado</h1>
        <p className="text-cinza">A reserva ficou em análise. Falta um passo: envia a descrição e as fotos à equipa no WhatsApp.</p>
        <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("primary", "lg", true)}>
          <MessageCircle strokeWidth={1.8} /> Enviar no WhatsApp
        </a>
        <ButtonLink href={`/reservas/${b.id}`} variant="ghost">
          Voltar à reserva
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>Reserva {code}</BackLink>
      <PageHeader title="Reportar problema" subtitle={`${b.itemTitle}. A equipa Beeznoo analisa e decide sobre a caução com base nas fotos.`} />

      {b.status !== "ACTIVE" ? (
        <Callout tone="info" icon={HelpCircle} title="Só durante o aluguer">
          Podes reportar um problema enquanto a reserva está em curso. Para outras dúvidas, fala connosco no WhatsApp.
        </Callout>
      ) : (
        <>
          <RadioCards<Kind>
            legend="O que aconteceu?"
            name="kind"
            value={kind}
            onChange={setKind}
            columns={2}
            options={[
              { value: "dano", title: "Dano", text: "Partiu, riscou ou deixou de funcionar", icon: Wrench },
              { value: "perda", title: "Perda", text: "Falta o equipamento ou um acessório", icon: PackageX },
              { value: "roubo", title: "Roubo", text: "Foi roubado durante o aluguer", icon: ShieldAlert },
              { value: "outro", title: "Outro", text: "Atraso, equipamento diferente…", icon: HelpCircle },
            ]}
          />
          <TextArea label="Conta o que se passou" value={text} onChange={setText} rows={5} maxLength={1500} error={errors.fields.text} placeholder="Quando, onde e como. Quanto mais concreto, mais depressa resolvemos." />
          <div className="grid gap-2">
            <p className="text-sm font-medium text-verde">Fotos</p>
            <PhotoPicker photos={photos.photos} onAdd={photos.add} onRemove={photos.remove} onCover={photos.makeCover} min={1} />
          </div>
          <Callout tone="warn" icon={AlertTriangle}>
            Em caso de roubo, faz também queixa na polícia e guarda o auto. A equipa vai pedi-lo.
          </Callout>
          <FormError message={errors.form} />
          <Button variant="dark" size="lg" block loading={busy} onClick={submit}>
            Reportar problema
          </Button>
          <p className="text-center text-[13px] text-cinza">
            A reserva fica marcada com problema. A seguir envias a descrição e as fotos à equipa por WhatsApp (até haver formulário no backend).
          </p>
        </>
      )}
    </div>
  );
}
