"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react";
import { HexIllustration, categoryIcon } from "@/components/bz/brand";
import { EquipmentCard } from "@/components/bz/equipment";
import { FormError, StepProgress, toFormErrors, type FormErrors } from "@/components/bz/form";
import { DetailsFields, EMPTY_DRAFT, PriceFields, draftToInput, validateDetails, validatePrice, type DraftErrors, type ItemDraft } from "@/components/bz/item-form";
import { toast } from "@/components/bz/overlay";
import { PhotoPicker, useLocalPhotos } from "@/components/bz/photo";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { BackendPending } from "@/components/bz/states";
import { Button, ButtonLink, Callout } from "@/components/bz/ui";
import { catalogApi, ownerItemApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { canOwn } from "@/lib/mode";
import type { Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const STEPS = ["Fotos", "Detalhes", "Preço e caução", "Pré-visualização"];
const DRAFT_KEY = "beeznoo.publicar.rascunho";

function loadDraft(): ItemDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export default function PublicarPage() {
  const session = useRequireSession();
  const router = useRouter();
  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const photos = useLocalPhotos();
  const [step, setStep] = useState(1);
  // O formulário só aparece com sessão (nunca no SSR), por isso ler o rascunho no 1.º render não causa erro de hidratação.
  const [draft, setDraft] = useState<ItemDraft>(() => (typeof window === "undefined" ? EMPTY_DRAFT : loadDraft()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formErr, setFormErr] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Item | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Rascunho automático (rede fraca, app fechada a meio). As fotos não entram: ficam só na memória.
  useEffect(() => {
    if (draft === EMPTY_DRAFT) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(new Date());
      } catch {
        /* sem storage */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draft]);

  if (!session) return null;
  if (!canOwn(session.role)) {
    return (
      <Callout tone="info" title="Publicar é para donos de equipamento" action={<ButtonLink href="/explorar" variant="outline">Ir para Explorar</ButtonLink>}>
        A tua conta está como arrendatário. Fala connosco para mudar para &quot;as duas coisas&quot;.
      </Callout>
    );
  }

  const set = (patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function next() {
    const e = step === 2 ? validateDetails(draft) : step === 3 ? validatePrice(draft) : {};
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  }

  async function publish() {
    setBusy(true);
    setFormErr({ fields: {} });
    try {
      const item = await ownerItemApi.publish(draftToInput(draft));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* sem storage */
      }
      setPublished(item);
      toast.success("Equipamento publicado.");
    } catch (e) {
      setFormErr(toFormErrors(e));
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={CheckCircle2} tone="ok" size={160} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">Está publicado!</h1>
        <p className="text-cinza">{published.title} já aparece em Explorar. Avisamos-te quando chegar o primeiro pedido.</p>
        <div className="grid w-full gap-2">
          <ButtonLink href={`/equipamento/${published.id}`} block>
            Ver como os outros veem
          </ButtonLink>
          <Button variant="ghost" block onClick={() => router.push("/equipamentos")}>
            Ir para o meu equipamento
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
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> Passo anterior
        </button>
      )}
      <PageHeader title="Publicar equipamento" subtitle={savedAt ? `Rascunho guardado às ${savedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : "Leva uns 3 minutos."} />
      <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />

      <div key={step} className="animate-sobe">
        {step === 1 && (
          <div className="grid gap-4">
            <Callout tone="dark" icon={Camera} title="Fotos vendem">
              Luz natural, fundo limpo, o equipamento inteiro. Mostra também os acessórios e qualquer marca de uso.
            </Callout>
            <PhotoPicker photos={photos.photos} onAdd={photos.add} onRemove={photos.remove} onCover={photos.makeCover} />
            <BackendPending what="O upload de fotos ainda não tem endpoint: o equipamento é publicado sem fotos." />
          </div>
        )}
        {step === 2 && <DetailsFields draft={draft} set={set} errors={errors} categories={categories} />}
        {step === 3 && <PriceFields draft={draft} set={set} errors={errors} />}
        {step === 4 && (
          <div className="grid gap-5">
            <p className="text-cinza">É assim que aparece em Explorar:</p>
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
            Continuar
          </Button>
        ) : (
          <Button block size="lg" loading={busy} onClick={publish}>
            Publicar
          </Button>
        )}
      </StickyCTA>
    </div>
  );
}
