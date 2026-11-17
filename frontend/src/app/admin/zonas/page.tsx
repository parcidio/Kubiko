"use client";

import { useState } from "react";
import { MapPinned, Pencil, Plus } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { Checkbox, FormError, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { Sheet, toast } from "@/components/bz/overlay";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Badge, Button, Card } from "@/components/bz/ui";
import { serviceAreaApi } from "@/lib/api-ops";
import type { ServiceArea, ServiceAreaInput } from "@/lib/types-ops";
import { useResource } from "@/lib/use-resource";

type Draft = { province: string; city: string; lat: string; lng: string; radiusKm: string; active: boolean };
const EMPTY: Draft = { province: "", city: "", lat: "", lng: "", radiusKm: "30", active: true };

const toDraft = (a: ServiceArea): Draft => ({
  province: a.province, city: a.city, lat: String(a.lat), lng: String(a.lng), radiusKm: String(a.radiusKm), active: a.active,
});

/** Converte vírgula decimal (teclados pt) e valida limites. */
function num(v: string) {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

function validate(d: Draft): { input?: ServiceAreaInput; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const lat = num(d.lat);
  const lng = num(d.lng);
  const radiusKm = num(d.radiusKm);
  if (d.province.trim().length < 2) fields.province = "Escreve a província.";
  if (d.city.trim().length < 2) fields.city = "Escreve a cidade.";
  if (lat === null || lat < -90 || lat > 90) fields.lat = "Latitude entre -90 e 90 (Luanda ≈ -8,84).";
  if (lng === null || lng < -180 || lng > 180) fields.lng = "Longitude entre -180 e 180 (Luanda ≈ 13,23).";
  if (radiusKm === null || radiusKm <= 0 || radiusKm > 500) fields.radiusKm = "Raio entre 1 e 500 km.";
  if (Object.keys(fields).length) return { fields };
  return { fields, input: { province: d.province.trim(), city: d.city.trim(), lat: lat!, lng: lng!, radiusKm: radiusKm!, active: d.active } };
}

/** Admin › Zonas: onde se pode publicar equipamento (piloto: Luanda). Sem apagar: desativa-se. */
export default function ZonasPage() {
  const areas = useResource<ServiceArea[]>("admin:service-areas", () => serviceAreaApi.list());
  const [editing, setEditing] = useState<ServiceArea | "new" | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggle(a: ServiceArea) {
    setToggling(a.id);
    try {
      await serviceAreaApi.update(a.id, { province: a.province, city: a.city, lat: a.lat, lng: a.lng, radiusKm: a.radiusKm, active: !a.active });
      toast.success(a.active ? `${a.city} desativada. Já não se publica lá.` : `${a.city} ativa. Já se pode publicar lá.`);
      areas.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar a zona.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="grid max-w-5xl gap-5">
      <AdminHeader
        title="Zonas"
        text="Só se publica equipamento dentro de uma zona ativa (centro + raio). Registo e verificação continuam abertos em todo o lado."
        action={
          <Button variant="dark" size="sm" onClick={() => setEditing("new")}>
            <Plus strokeWidth={1.8} aria-hidden /> Nova zona
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {areas.error ? (
          <ErrorState message={areas.error} onRetry={areas.reload} />
        ) : !areas.data ? (
          <div className="p-4"><ListSkeleton rows={3} label="A carregar zonas" /></div>
        ) : areas.data.length === 0 ? (
          <EmptyState icon={MapPinned} title="Ainda sem zonas" text="Sem zonas ativas ninguém consegue publicar. Cria Luanda primeiro." />
        ) : (
          <ul aria-label="Zonas de serviço">
            {areas.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
                <span className="grid min-w-0 flex-1 basis-56 gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-verde">{a.city}</span>
                    <span className="text-sm text-cinza">{a.province}</span>
                    <Badge tone={a.active ? "ok" : "neutro"}>{a.active ? "Ativa" : "Inativa"}</Badge>
                  </span>
                  <span className="num text-[13px] text-cinza">
                    Centro {a.lat.toFixed(2)}, {a.lng.toFixed(2)} · raio {a.radiusKm} km
                  </span>
                </span>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-verde">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={a.active}
                    disabled={toggling === a.id}
                    onChange={() => toggle(a)}
                    className="size-5 accent-[var(--color-verde-medio)]"
                  />
                  Ativa
                </label>
                <Button variant="outline" size="sm" onClick={() => setEditing(a)} aria-label={`Editar ${a.city}`}>
                  <Pencil strokeWidth={1.8} aria-hidden /> Editar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AreaSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        area={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          areas.reload();
        }}
      />
    </div>
  );
}

function AreaSheet({ area, onClose, onSaved }: { area: ServiceArea | "new" | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(area && area !== "new" ? toDraft(area) : EMPTY);
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save() {
    const v = validate(d);
    if (!v.input) return setErrors({ fields: v.fields });
    setBusy(true);
    setErrors({ fields: {} });
    try {
      if (area && area !== "new") await serviceAreaApi.update(area.id, v.input);
      else await serviceAreaApi.create(v.input);
      toast.success("Zona guardada.");
      onSaved();
    } catch (e) {
      setErrors(toFormErrors(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={area !== null}
      onClose={onClose}
      title={area && area !== "new" ? `Editar ${area.city}` : "Nova zona"}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="dark" block loading={busy} onClick={save}>Guardar zona</Button>
        </div>
      }
    >
      <div className="grid gap-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Província" value={d.province} onChange={(v) => set({ province: v })} error={errors.fields.province} maxLength={80} />
          <TextField label="Cidade" value={d.city} onChange={(v) => set({ city: v })} error={errors.fields.city} maxLength={80} />
          <TextField label="Latitude do centro" inputMode="decimal" value={d.lat} onChange={(v) => set({ lat: v })} error={errors.fields.lat} placeholder="-8.84" />
          <TextField label="Longitude do centro" inputMode="decimal" value={d.lng} onChange={(v) => set({ lng: v })} error={errors.fields.lng} placeholder="13.23" />
        </div>
        <TextField
          label="Raio (km)"
          inputMode="decimal"
          value={d.radiusKm}
          onChange={(v) => set({ radiusKm: v })}
          error={errors.fields.radiusKm}
          hint="Quem estiver a esta distância do centro, ou menos, pode publicar."
        />
        <Checkbox checked={d.active} onChange={(v) => set({ active: v })}>
          Zona ativa (já se pode publicar)
        </Checkbox>
        <FormError message={errors.form} />
      </div>
    </Sheet>
  );
}
