"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, Pause, Trash2 } from "lucide-react";
import { MonthCalendar } from "@/components/bz/calendar";
import { FormError, toFormErrors, type FormErrors } from "@/components/bz/form";
import { DetailsFields, PriceFields, draftFromItem, draftToInput, validateDetails, validatePrice, type DraftErrors, type ItemDraft } from "@/components/bz/item-form";
import { Sheet, toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { BackendPending, ErrorState } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Card, Skeleton } from "@/components/bz/ui";
import { catalogApi, ownerItemApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import type { Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Tab = "detalhes" | "preco" | "datas";

export default function GerirEquipamentoPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const item = useResource<Item>(session ? `item:${id}` : null, () => catalogApi.item(id));
  const [tab, setTab] = useState<Tab>("detalhes");
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formErr, setFormErr] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  if (!session) return null;
  if (item.error) return <ErrorState message={item.error} onRetry={item.reload} />;
  if (!item.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  if (item.data.ownerId !== session.profileId) {
    return <ErrorState message="Este equipamento não é teu." />;
  }

  const d = draft ?? draftFromItem(item.data);
  const set = (patch: Partial<ItemDraft>) => setDraft({ ...d, ...patch });

  async function save() {
    const e = { ...validateDetails(d), ...validatePrice(d) };
    setErrors(e);
    if (Object.keys(e).length) {
      setTab(e.title || e.categoryId || e.city ? "detalhes" : "preco");
      return;
    }
    setBusy(true);
    setFormErr({ fields: {} });
    try {
      item.setData(await ownerItemApi.update(id, draftToInput(d)));
      setDraft(null);
      toast.success("Alterações guardadas.");
    } catch (err) {
      setFormErr(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    try {
      await ownerItemApi.deactivate(id);
      toast.success("Pausado. Já não aparece em Explorar.");
      router.push("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pausar.");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await ownerItemApi.remove(id);
      toast.success("Equipamento eliminado.");
      router.replace("/equipamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível eliminar.");
      setBusy(false);
    }
  }

  const toggle = (day: string) =>
    setBlocked((s) => {
      const n = new Set(s);
      if (n.has(day)) n.delete(day);
      else n.add(day);
      return n;
    });

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href="/equipamentos">O meu equipamento</BackLink>
      <PageHeader
        title={item.data.title}
        action={
          <ButtonLink href={`/equipamento/${id}`} variant="soft" size="sm" aria-label="Ver anúncio">
            <Eye strokeWidth={1.8} /> <span className="hidden sm:inline">Ver anúncio</span>
          </ButtonLink>
        }
      />
      <Segmented
        label="Secções"
        value={tab}
        onChange={setTab}
        options={[
          { value: "detalhes", label: "Detalhes" },
          { value: "preco", label: "Preço" },
          { value: "datas", label: "Datas" },
        ]}
      />
      <div key={tab} className="animate-sobe">
        {tab === "detalhes" && <DetailsFields draft={d} set={set} errors={errors} categories={categories} />}
        {tab === "preco" && <PriceFields draft={d} set={set} errors={errors} />}
        {tab === "datas" && (
          <Card className="grid gap-4 p-4">
            <p className="text-texto-corpo">Toca nos dias em que o equipamento não está disponível.</p>
            <MonthCalendar marked={blocked} onToggle={toggle} />
            <BackendPending what="Bloqueio manual de datas (availability_blocks) não tem endpoint." />
          </Card>
        )}
      </div>
      <FormError message={formErr.form ?? Object.values(formErr.fields)[0]} />

      {tab !== "datas" && (
        <StickyCTA>
          <Button block size="lg" loading={busy} disabled={!draft} onClick={save}>
            Guardar alterações
          </Button>
        </StickyCTA>
      )}

      <Card className="grid gap-2 p-4">
        <p className="font-bold text-verde">Zona de cuidado</p>
        <div className="flex flex-wrap gap-2">
          {item.data.status === "ACTIVE" && (
            <Button variant="outline" size="sm" onClick={pause}>
              <Pause strokeWidth={1.8} /> Pausar anúncio
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 strokeWidth={1.8} /> Eliminar
          </Button>
        </div>
      </Card>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar equipamento?"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" block loading={busy} onClick={remove}>
              Sim, eliminar
            </Button>
          </div>
        }
      >
        <p className="pt-2">Deixa de aparecer em Explorar e não podes receber novos pedidos. Os alugueres já feitos ficam no histórico.</p>
      </Sheet>
    </div>
  );
}
