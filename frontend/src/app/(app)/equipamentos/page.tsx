"use client";

import Link from "next/link";
import { Package, Pause, Pencil, Plus } from "lucide-react";
import { ItemPhoto } from "@/components/bz/equipment";
import { toast } from "@/components/bz/overlay";
import { PageHeader } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Badge, Button, ButtonLink, Card, Kz, type Tone } from "@/components/bz/ui";
import { ownerItemApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { CONDITION_LABEL } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "ok" },
  INACTIVE: { label: "Pausado", tone: "neutro" },
  SUSPENDED: { label: "Em revisão", tone: "erro" },
};

export default function EquipamentosPage() {
  const session = useRequireSession();
  const { data, error, loading, reload } = useResource(session ? "items:mine" : null, () => ownerItemApi.mine());

  if (!session) return null;
  const items = data?.content ?? [];

  async function pause(id: string) {
    try {
      await ownerItemApi.deactivate(id);
      toast.success("Pausado. Já não aparece em Explorar.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pausar.");
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <PageHeader
        title="O meu equipamento"
        subtitle={items.length ? `${items.length} ${items.length === 1 ? "equipamento" : "equipamentos"}` : undefined}
        action={
          <ButtonLink href="/publicar" variant="dark" size="sm" className="hidden md:inline-flex">
            <Plus strokeWidth={2} /> Publicar
          </ButtonLink>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          tone="ambar"
          title="Põe o teu equipamento a render"
          text="Câmaras, lentes, luzes, colunas. Quem tem equipamento parado em Luanda ganha com ele na Beeznoo."
          action={<ButtonLink href="/publicar"><Plus strokeWidth={2} /> Publicar o primeiro</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item, i) => {
            const st = STATUS[item.status] ?? { label: item.status, tone: "neutro" as Tone };
            return (
              <li key={item.id}>
                <Card className="grid animate-sobe gap-3 p-3" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <Link href={`/equipamentos/${item.id}`} className="flex gap-3">
                    <ItemPhoto src={item.coverPhoto} alt={item.title} className="w-24 shrink-0 rounded-campo" />
                    <div className="grid min-w-0 content-start gap-1">
                      <p className="line-clamp-2 font-titulo font-bold text-verde">{item.title}</p>
                      <p className="text-[13px] text-cinza">{CONDITION_LABEL[item.condition]} · {item.city ?? "Luanda"}</p>
                      <p className="text-verde">
                        <Kz value={item.pricePerDay} className="text-lg" />
                        <span className="text-[13px] text-cinza"> /dia</span>
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 border-t border-borda pt-3">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <div className="ml-auto flex gap-2">
                      {item.status === "ACTIVE" && (
                        <Button variant="ghost" size="sm" onClick={() => pause(item.id)}>
                          <Pause strokeWidth={1.8} /> Pausar
                        </Button>
                      )}
                      <ButtonLink href={`/equipamentos/${item.id}`} variant="soft" size="sm">
                        <Pencil strokeWidth={1.8} /> Gerir
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
