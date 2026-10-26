"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { KeyRound, Sun } from "lucide-react";
import { CameraSlot } from "@/components/bz/photo";
import { OtpField, TextArea } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { BackendPending } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button } from "@/components/bz/ui";
import { useRequireSession } from "@/lib/auth";
import { bookingCode } from "@/lib/booking";

const ANGLES = [
  { key: "frente", label: "Frente", hint: "Equipamento inteiro, de frente" },
  { key: "tras", label: "Traseira", hint: "Ecrã e botões visíveis" },
  { key: "lados", label: "Lados", hint: "Portas e encaixes" },
  { key: "serie", label: "Número de série", hint: "Etiqueta legível" },
  { key: "acessorios", label: "Acessórios", hint: "Bateria, carregador, mala" },
  { key: "detalhe", label: "Marcas existentes", hint: "Riscos ou desgaste já existentes" },
];

type Phase = "entrega" | "devolucao";

export default function ChecklistPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("entrega");
  const [photos, setPhotos] = useState<Record<Phase, Record<string, string>>>({ entrega: {}, devolucao: {} });
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (!session) return null;
  const current = photos[phase];
  const done = ANGLES.filter((a) => current[a.key]).length;
  const complete = done === ANGLES.length;

  function pick(key: string, file: File) {
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setPhotos((p) => ({ ...p, [phase]: { ...p[phase], [key]: url } }));
  }

  return (
    // Ecrã escuro, como uma câmara: melhor contraste ao fotografar
    <div className="-mx-4 -mt-5 min-h-[calc(100dvh-4rem)] bg-verde-noite px-4 pt-5 pb-10 text-areia md:mx-0 md:mt-0 md:rounded-sheet md:p-8">
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="[&_a]:text-ambar">
          <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
        </div>
        <div className="grid gap-2">
          <h1 className="font-titulo text-[30px] leading-tight font-extrabold">Checklist com fotos</h1>
          <p className="text-areia/75">Fotografem juntos, no momento da {phase === "entrega" ? "entrega" : "devolução"}. As fotos são a prova do estado do equipamento.</p>
        </div>
        <Segmented
          dark
          label="Momento"
          value={phase}
          onChange={setPhase}
          options={[
            { value: "entrega", label: "Entrega" },
            { value: "devolucao", label: "Devolução" },
          ]}
        />

        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">
              {done} de {ANGLES.length} fotos
            </span>
            <span className="flex items-center gap-1.5 text-areia/70">
              <Sun className="size-4 text-ambar" strokeWidth={1.8} aria-hidden /> Procura boa luz, sem flash
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-ambar transition-all" style={{ width: `${(done / ANGLES.length) * 100}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ANGLES.map((a) => (
            <div key={a.key} className="grid gap-2">
              <CameraSlot label={a.label} hint={a.hint} photo={current[a.key]} onPick={(f) => pick(a.key, f)} />
              {phase === "devolucao" && photos.entrega[a.key] && (
                <p className="text-[12px] text-areia/60">Também fotografado na entrega</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-cartao bg-white/5 p-4 [&_label]:text-areia [&_textarea]:border-white/20 [&_textarea]:bg-white/5 [&_textarea]:text-areia">
          <TextArea label="Notas sobre o estado" value={notes} onChange={setNotes} rows={3} placeholder="Ex.: pequeno risco no canto inferior do ecrã, já existia." />
        </div>

        <div className="grid gap-3 rounded-cartao border border-white/15 p-4 [&_label]:text-areia">
          <p className="flex items-center gap-2 font-bold">
            <KeyRound className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Confirmação das duas partes
          </p>
          <p className="text-sm text-areia/75">
            O dono mostra um código de 4 dígitos no telemóvel dele e tu escreves aqui. Assim fica provado que estiveram juntos.
          </p>
          <OtpField value={code} onChange={setCode} length={4} />
        </div>

        <BackendPending what="Checklists, fotos de checklist e código de confirmação não têm endpoint (proposta do código: decisão do PM)." className="text-aviso-texto" />

        <Button size="lg" block disabled={!complete || code.length !== 4} onClick={() => toast("Ainda não fica guardado: falta o backend da checklist.")}>
          {complete ? (phase === "entrega" ? "Confirmar entrega" : "Confirmar devolução") : `Faltam ${ANGLES.length - done} fotos`}
        </Button>
      </div>
    </div>
  );
}
