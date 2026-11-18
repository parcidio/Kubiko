"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { categoryIcon } from "@/components/bz/brand";
import { EquipmentCard } from "@/components/bz/equipment";
import { FormError, StepProgress, toFormErrors, type FormErrors } from "@/components/bz/form";
import { DetailsFields, EMPTY_DRAFT, PriceFields, draftToInput, validateDetails, validatePrice, type DraftErrors, type ItemDraft } from "@/components/bz/item-form";
import { AreaNotAvailable, isAreaNotAvailable, isLocationRequired, PublishLocationCard, usePublishLocation } from "@/components/bz/location";
import { toast } from "@/components/bz/overlay";
import { Tip } from "@/components/bz/tip";
import { PhotoPicker, useLocalPhotos } from "@/components/bz/photo";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { SuccessCheck } from "@/components/bz/success";
import { Button, ButtonLink, Callout } from "@/components/bz/ui";
import { catalogApi, ownerItemApi } from "@/lib/api";
import { DRAFT_KEY_PREFIX, useRequireSession } from "@/lib/auth";
import { compressImage } from "@/lib/images";
import { canOwn } from "@/lib/mode";
import type { Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { isKycRequired, kycRedirectToast } from "@/lib/kyc";
import { KycCard } from "@/components/bz/kyc";
import { fmt, LOCALE } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

const MAX_PHOTOS = 8; // limite da API

// Rascunho por conta: no mesmo browser, outra pessoa nunca vê o rascunho de quem saiu
const draftKey = (profileId: string) => `${DRAFT_KEY_PREFIX}.${profileId}`;

function loadDraft(profileId: string): ItemDraft {
  try {
    localStorage.removeItem(DRAFT_KEY_PREFIX); // chave antiga, partilhada por todas as contas
    const raw = localStorage.getItem(draftKey(profileId));
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export default function PublicarPage() {
  const session = useRequireSession();
  const t = useT().publish;

  if (!session) return null;
  if (!canOwn(session.role)) {
    return (
      <Callout tone="info" title={t.ownersOnlyTitle} action={<ButtonLink href="/explorar" variant="outline">{t.goExplore}</ButtonLink>}>
        {t.ownersOnlyText}
      </Callout>
    );
  }
  // key: trocar de conta recomeça o formulário com o rascunho dessa conta
  return <PublicarForm key={session.profileId} profileId={session.profileId} />;
}

const LOCATION_CARD_ID = "publicar-zona";

function PublicarForm({ profileId }: { profileId: string }) {
  const router = useRouter();
  const lang = useLang();
  const dict = useT();
  const t = dict.publish;
  // Piloto: só se publica numa zona ativa (decisoes-produto.md 2026-11-17). O formulário aparece logo; a zona
  // resolve-se ao lado, sem bloquear (2026-11-18): posição já autorizada, zona guardada na conta, ou escolha.
  const zone = usePublishLocation({ title: dict.location.publishTitle });
  const STEPS = t.steps;
  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const photos = useLocalPhotos(MAX_PHOTOS);
  const [step, setStep] = useState(1);
  // Só é montado com sessão no cliente, por isso ler o localStorage no 1.º render não causa erro de hidratação.
  const [draft, setDraft] = useState<ItemDraft>(() => loadDraft(profileId));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formErr, setFormErr] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Item | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [outside, setOutside] = useState(false);

  // Rascunho automático (rede fraca, app fechada a meio). As fotos não entram: ficam só na memória.
  useEffect(() => {
    if (draft === EMPTY_DRAFT) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(profileId), JSON.stringify(draft));
        setSavedAt(new Date());
      } catch {
        /* sem storage */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draft, profileId]);

  const set = (patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function next() {
    const e = step === 2 ? validateDetails(draft) : step === 3 ? validatePrice(draft) : {};
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  }

  function needZone(message: string) {
    setFormErr({ form: message, fields: {} });
    document.getElementById(LOCATION_CARD_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function publish() {
    if (!zone.where) return needZone(dict.location.needZoneToPublish);
    setBusy(true);
    setFormErr({ fields: {} });
    try {
      let item: Item;
      try {
        item = await ownerItemApi.publish(draftToInput(draft), zone.where);
      } catch (e) {
        if (!isLocationRequired(e)) throw e;
        // a zona guardada caducou ou a API não a aceitou: a pessoa escolhe outra vez, sem perder o formulário
        zone.reset(t.needLocation);
        needZone(dict.location.needZoneToPublish);
        return;
      }
      try {
        localStorage.removeItem(draftKey(profileId));
      } catch {
        /* sem storage */
      }
      // O ecrã de sucesso só aparece com as fotos já enviadas ("Ver como os outros veem" mostra-as logo)
      if (photos.photos.length > 0) {
        try {
          const files = await Promise.all(photos.photos.map((p) => compressImage(p.file)));
          await ownerItemApi.uploadPhotos(item.id, files);
          toast.success(t.publishedWithPhotos);
        } catch (e) {
          // o item já existe: as fotos acrescentam-se em Gerir equipamento › Fotos
          toast.error(fmt(t.photosFailed, { reason: e instanceof Error ? e.message : t.network }));
        }
      } else {
        toast.success(t.published);
      }
      setPublished(item);
    } catch (e) {
      if (isAreaNotAvailable(e)) {
        if (zone.state.kind === "gps") return setOutside(true);
        // zona escolhida/guardada recusada: mostrar o cartão para partilhar a localização
        zone.reset(dict.location.areaNotAvailable);
        return needZone(dict.location.areaNotAvailable);
      }
      if (isKycRequired(e)) {
        toast(kycRedirectToast());
        router.push("/verificacao");
        return;
      }
      setFormErr(toFormErrors(e));
    } finally {
      setBusy(false);
    }
  }

  if (outside) return <AreaNotAvailable />;

  if (published) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <SuccessCheck />
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde md:text-[32px]">{t.doneTitle}</h1>
        <p className="text-cinza">{fmt(t.doneText, { title: published.title })}</p>
        <div className="grid w-full gap-2">
          <ButtonLink href={`/equipamento/${published.id}`} block>
            {t.seeAsOthers}
          </ButtonLink>
          <Button variant="ghost" block onClick={() => router.push("/equipamentos")}>
            {t.goMyItems}
          </Button>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === draft.categoryId);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {step > 1 && (
        <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline">
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> {t.previousStep}
        </button>
      )}
      {/* Avisa antes de a pessoa preencher tudo: publicar exige identidade verificada */}
      {step === 1 && <KycCard context="publish" />}
      <PageHeader title={t.title} subtitle={savedAt ? fmt(t.draftSavedAt, { time: savedAt.toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" }) }) : t.takesMinutes} />
      <PublishLocationCard loc={zone} id={LOCATION_CARD_ID} />
      <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />
      {step === 1 && <Tip id="publish" title={dict.tips.publish.title} steps={dict.tips.publish.steps} />}

      <div key={step} className="animate-sobe">
        {step === 1 && (
          <div className="grid gap-4">
            <Callout tone="dark" icon={Camera} title={t.photosSellTitle}>
              {t.photosSellText}
            </Callout>
            <PhotoPicker photos={photos.photos} onAdd={photos.add} onRemove={photos.remove} onCover={photos.makeCover} />
            <p className="text-sm text-cinza">{fmt(t.photosLimit, { max: MAX_PHOTOS })}</p>
          </div>
        )}
        {step === 2 && <DetailsFields draft={draft} set={set} errors={errors} categories={categories} />}
        {step === 3 && <PriceFields draft={draft} set={set} errors={errors} />}
        {step === 4 && (
          <div className="grid gap-5">
            <p className="text-cinza">{t.previewIntro}</p>
            <div className="max-w-[260px]">
              <EquipmentCard
                href="#"
                icon={categoryIcon(category?.slug)}
                item={{
                  id: "preview",
                  categorySlug: category?.slug ?? null,
                  ratingAverage: null,
                  ratingCount: 0,
                  completedRentals: 0,
                  featured: false,
                  ownerVerified: false,
                  title: draft.title,
                  condition: draft.condition,
                  pricePerDay: Number(draft.pricePerDay),
                  province: "Luanda",
                  city: draft.city,
                  status: "ACTIVE",
                  coverPhoto: photos.photos[0]?.url ?? null,
                  createdAt: new Date().toISOString(),
                }}
              />
            </div>
            <FormError message={formErr.form ?? Object.values(formErr.fields)[0]} />
          </div>
        )}
      </div>

      <StickyCTA>
        {step < STEPS.length ? (
          <Button block size="lg" variant="dark" onClick={next}>
            {t.continue}
          </Button>
        ) : (
          <Button block size="lg" loading={busy} onClick={publish}>
            {t.publish}
          </Button>
        )}
      </StickyCTA>
    </div>
  );
}
