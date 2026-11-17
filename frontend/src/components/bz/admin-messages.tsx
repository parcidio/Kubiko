"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ChevronRight, FileText, Mail, MessageCircle, MessageSquare, Pencil, Phone, Plus, Search, Send, Trash2, X,
} from "lucide-react";
import { ChipGroup, FormError, inputClass, RadioCards, SelectField, TextArea, TextField, toFormErrors, type FormErrors } from "./form";
import { Sheet, toast } from "./overlay";
import { EmptyState, ErrorState, ListSkeleton } from "./states";
import { Badge, Button, Callout, Card, type Tone } from "./ui";
import { adminApi, ApiError } from "@/lib/api";
import { adminMessageApi, serviceAreaApi } from "@/lib/api-ops";
import { formatDateTime } from "@/lib/format";
import type { AdminUserSummary, Page } from "@/lib/types";
import type {
  AdminMessageSummary, DeliveryStatus, MessageAudience, MessageChannel, MessageInput, MessagePreview, MessageTemplate, ServiceArea,
  WhatsAppCheck,
} from "@/lib/types-ops";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

/** Admin › Mensagens (decisoes-produto.md 2026-11-17, ponto 2). Só saída: não é chat. */

export const CHANNEL_LABEL: Record<MessageChannel, string> = { WHATSAPP: "WhatsApp", EMAIL: "Email", SMS: "SMS" };
export const CHANNEL_ICON = { WHATSAPP: MessageCircle, EMAIL: Mail, SMS: MessageSquare } as const;
/** Limite de destinatários por envio (contrato). */
export const CHANNEL_LIMIT: Record<MessageChannel, number> = { WHATSAPP: 300, EMAIL: 2000, SMS: 2000 };

export const DELIVERY: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Por enviar", tone: "pendente" },
  SENT: { label: "Enviada", tone: "ok" },
  FAILED: { label: "Falhou", tone: "erro" },
  SKIPPED: { label: "Ignorada", tone: "neutro" },
};

const SKIPPED_LABEL: Record<string, string> = {
  noPhone: "sem telefone",
  noEmail: "sem email",
  foreignNoWhatsapp: "número estrangeiro sem WhatsApp",
  foreignSms: "número estrangeiro (SMS só chega a +244)",
  suspended: "conta suspensa",
};

const VARIABLES = ["{{nome}}", "{{primeiro_nome}}"];
const BODY_MAX = 1000;

type AudienceType = MessageAudience["type"];
type Picked = Pick<AdminUserSummary, "id" | "fullName" | "phone">;

function errorText(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

// ── Compor ───────────────────────────────────────────────────────────────
export function MessageComposer() {
  const router = useRouter();
  const templates = useResource<MessageTemplate[]>("admin:msg-templates", () => adminMessageApi.templates());
  const areas = useResource<ServiceArea[]>("admin:service-areas", () => serviceAreaApi.list());

  const [channel, setChannel] = useState<MessageChannel>("EMAIL");
  const [audienceType, setAudienceType] = useState<AudienceType>("USERS");
  const [people, setPeople] = useState<Picked[]>([]);
  const [areaId, setAreaId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ key: string; data: MessagePreview } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [formErr, setFormErr] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const usable = (templates.data ?? []).filter((t) => !t.channel || t.channel === channel);
  const template = usable.find((t) => t.id === templateId);

  const audience: MessageAudience | null =
    audienceType === "USERS" ? (people.length ? { type: "USERS", userIds: people.map((p) => p.id) } : null)
      : audienceType === "CITY" ? (areaId ? { type: "CITY", areaId } : null)
        : { type: audienceType };

  const input: MessageInput | null = !audience
    ? null
    : template
      ? { channel, audience, templateId: template.id }
      : { channel, audience, body: body.trim(), subject: channel === "EMAIL" ? subject.trim() || undefined : undefined };

  const key = JSON.stringify(input);
  const current = preview && preview.key === key ? preview.data : null;

  function validate() {
    const f: Record<string, string> = {};
    if (audienceType === "USERS" && people.length === 0) f.audience = "Escolhe pelo menos uma pessoa.";
    if (audienceType === "CITY" && !areaId) f.audience = "Escolhe a zona.";
    if (!template) {
      if (!body.trim()) f.body = "Escreve a mensagem ou escolhe um modelo.";
      if (channel === "EMAIL" && !subject.trim()) f.subject = "O email precisa de assunto.";
    }
    setFieldErr(f);
    return Object.keys(f).length === 0;
  }

  async function runPreview() {
    if (!validate() || !input) return;
    setPreviewing(true);
    setFormErr(undefined);
    try {
      setPreview({ key, data: await adminMessageApi.preview(input) });
    } catch (e) {
      setFormErr(errorText(e, "Não foi possível pré-visualizar."));
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    if (!input) return;
    setSending(true);
    try {
      const res = await adminMessageApi.send(input);
      toast.success(`A enviar a ${res.reachable} ${res.reachable === 1 ? "pessoa" : "pessoas"}. Acompanha os estados aqui.`);
      router.push(`/admin/mensagens/${res.id}`);
    } catch (e) {
      setConfirm(false);
      setFormErr(errorText(e, "Não foi possível enviar."));
    } finally {
      setSending(false);
    }
  }

  function insertVariable(v: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = (body.slice(0, start) + v + body.slice(end)).slice(0, BODY_MAX);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + v.length, start + v.length);
    });
  }

  const overLimit = current ? current.reachable > CHANNEL_LIMIT[channel] : false;
  const skippedTotal = current ? Object.values(current.skipped).reduce((n, v) => n + (v ?? 0), 0) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="grid gap-5">
        {/* 1. Canal */}
        <Card className="grid gap-4 p-5">
          <RadioCards<MessageChannel>
            legend="Canal"
            name="channel"
            value={channel}
            onChange={(c) => {
              setChannel(c);
              if (template && template.channel && template.channel !== c) setTemplateId("");
            }}
            columns={3}
            options={[
              { value: "EMAIL", title: "Email", text: "Grátis. Só quem tem email.", icon: Mail },
              { value: "WHATSAPP", title: "WhatsApp", text: "Chega a todos. Custa mais.", icon: MessageCircle },
              { value: "SMS", title: "SMS", text: "Só números +244.", icon: MessageSquare },
            ]}
          />
          {channel === "WHATSAPP" && (
            <Callout tone="warn" icon={AlertTriangle} title="WhatsApp custa mais">
              Cada mensagem é paga. Usa para o que é urgente ou para quem não tem email. Até {CHANNEL_LIMIT.WHATSAPP} pessoas por envio, enviadas
              com pausas para não parecer spam.
            </Callout>
          )}
          {channel === "SMS" && (
            <Callout tone="info" icon={Phone} title="Números estrangeiros só recebem por WhatsApp">
              O SMS só chega a números angolanos (+244). Quem tem número estrangeiro fica de fora deste envio.
            </Callout>
          )}
        </Card>

        {/* 2. A quem */}
        <Card className="grid gap-4 p-5">
          <h2 className="font-titulo text-lg font-bold text-verde">A quem</h2>
          <ChipGroup<AudienceType>
            label="Destinatários"
            value={audienceType}
            onChange={setAudienceType}
            options={[
              { value: "USERS", label: "Pessoas" },
              { value: "ALL", label: "Todos" },
              { value: "VERIFIED", label: "Verificados" },
              { value: "UNVERIFIED", label: "Não verificados" },
              { value: "CITY", label: "Por zona" },
            ]}
          />
          {audienceType === "USERS" && <PeoplePicker value={people} onChange={setPeople} />}
          {audienceType === "CITY" &&
            (areas.error ? (
              <ErrorState message={areas.error} onRetry={areas.reload} className="py-4" />
            ) : (
              <SelectField
                label="Zona"
                value={areaId}
                onChange={setAreaId}
                placeholder={areas.data ? "Escolhe a zona" : "A carregar zonas…"}
                options={(areas.data ?? []).map((a) => ({ value: a.id, label: `${a.city}, ${a.province}${a.active ? "" : " (inativa)"}` }))}
              />
            ))}
          {audienceType === "ALL" && <p className="text-sm text-cinza">Todas as contas ativas. As suspensas ficam de fora.</p>}
          {fieldErr.audience && <p className="text-[13px] font-medium text-erro" role="alert">{fieldErr.audience}</p>}
        </Card>

        {/* 3. Mensagem */}
        <Card className="grid gap-4 p-5">
          <h2 className="font-titulo text-lg font-bold text-verde">Mensagem</h2>
          <TemplateSelect templates={usable} loading={!templates.data && !templates.error} value={templateId} onChange={setTemplateId} />
          {templates.error && <p className="text-sm text-erro">Não conseguimos carregar os modelos. Escreve texto livre ou <button type="button" className="underline" onClick={templates.reload}>tenta outra vez</button>.</p>}

          {template ? (
            <div className="grid gap-3 rounded-campo border border-borda bg-areia p-4">
              {template.subject && channel === "EMAIL" && <p className="text-sm"><b>Assunto:</b> {template.subject}</p>}
              <p className="text-[15px] whitespace-pre-line">{template.body}</p>
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => {
                  setBody(template.body.slice(0, BODY_MAX));
                  setSubject(template.subject ?? "");
                  setTemplateId("");
                }}
              >
                <Pencil strokeWidth={1.8} aria-hidden /> Editar como texto livre
              </Button>
            </div>
          ) : (
            <>
              {channel === "EMAIL" && (
                <TextField label="Assunto" value={subject} onChange={setSubject} maxLength={150} error={fieldErr.subject} />
              )}
              <TextArea
                ref={bodyRef}
                label="Texto"
                value={body}
                onChange={setBody}
                rows={6}
                maxLength={BODY_MAX}
                error={fieldErr.body}
                hint={`${body.length}/${BODY_MAX}. Curto e concreto: o quê, até quando, o que fazer.`}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-cinza">Variáveis:</span>
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="min-h-11 rounded-full border-[1.5px] border-borda-forte bg-branco px-3 font-mono text-[13px] text-verde hover:border-verde"
                    aria-label={`Inserir ${v}`}
                  >
                    {v}
                  </button>
                ))}
                <span className="text-[13px] text-cinza">{"{{nome}}"} = nome completo · {"{{primeiro_nome}}"} = só o primeiro.</span>
              </div>
            </>
          )}
        </Card>

        {/* 4. Pré-visualizar e enviar */}
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-titulo text-lg font-bold text-verde">Antes de enviar</h2>
            <Button variant="outline" size="sm" loading={previewing} onClick={runPreview}>
              Pré-visualizar
            </Button>
          </div>
          {!current ? (
            <p className="text-sm text-cinza">
              {preview ? "Mudaste alguma coisa. Pré-visualiza outra vez." : "Pré-visualiza para ver a quem chega e como fica a mensagem."}
            </p>
          ) : (
            <div className="grid gap-3" aria-live="polite">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Destinatários" value={current.recipients} />
                <Stat label="Recebem" value={current.reachable} strong />
                <Stat label="Ficam de fora" value={skippedTotal} />
              </div>
              {skippedTotal > 0 && (
                <ul className="grid gap-1 text-sm text-cinza">
                  {Object.entries(current.skipped)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => (
                      <li key={k}>
                        <span className="num font-bold text-verde">{n}</span> {SKIPPED_LABEL[k] ?? k}
                      </li>
                    ))}
                </ul>
              )}
              {overLimit && (
                <Callout tone="erro" icon={AlertTriangle}>
                  Mais de {CHANNEL_LIMIT[channel]} pessoas por {CHANNEL_LABEL[channel]}. Reduz o público ou divide o envio.
                </Callout>
              )}
              {current.sample && (
                <div className="grid gap-1 rounded-campo border border-borda bg-areia p-4">
                  <p className="text-xs font-bold tracking-[0.1em] text-cinza uppercase">Exemplo para uma pessoa</p>
                  {current.sample.subject && <p className="font-bold text-verde">{current.sample.subject}</p>}
                  <p className="text-[15px] whitespace-pre-line">{current.sample.body}</p>
                </div>
              )}
            </div>
          )}
          <FormError message={formErr} />
          <Button
            size="lg"
            block
            disabled={!current || current.reachable === 0 || overLimit}
            onClick={() => setConfirm(true)}
            aria-describedby={!current ? "envio-falta" : undefined}
          >
            <Send strokeWidth={1.8} aria-hidden /> Enviar
          </Button>
          {!current && <p id="envio-falta" className="-mt-2 text-center text-[13px] text-cinza">Pré-visualiza primeiro.</p>}
        </Card>
      </div>

      <WhatsAppCheckCard />

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={current ? `Enviar a ${current.reachable} ${current.reachable === 1 ? "pessoa" : "pessoas"} por ${CHANNEL_LABEL[channel]}?` : "Enviar?"}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="dark" block loading={sending} onClick={send}>
              Sim, enviar
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 pt-2 text-[15px]">
          <p>Depois de enviar não dá para anular. Os estados de cada entrega aparecem no histórico.</p>
          {channel === "WHATSAPP" && <p className="text-sm text-aviso-texto">WhatsApp: cada mensagem é paga.</p>}
          {skippedTotal > 0 && <p className="text-sm text-cinza">{skippedTotal} ficam de fora (sem contacto para este canal).</p>}
        </div>
      </Sheet>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("grid gap-0.5 rounded-campo p-3", strong ? "bg-salvia-tint" : "bg-areia")}>
      <span className="num font-titulo text-2xl font-extrabold text-verde">{value}</span>
      <span className="text-[13px] text-cinza">{label}</span>
    </div>
  );
}

function TemplateSelect({ templates, loading, value, onChange }: { templates: MessageTemplate[]; loading: boolean; value: string; onChange: (v: string) => void }) {
  const predefined = templates.filter((t) => t.predefined);
  const own = templates.filter((t) => !t.predefined);
  return (
    <div className="grid gap-2">
      <label htmlFor="msg-template" className="text-sm font-medium text-verde">Modelo</label>
      <select id="msg-template" className={cn(inputClass, "pr-10")} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? "A carregar modelos…" : "Texto livre"}</option>
        {predefined.length > 0 && (
          <optgroup label="Predefinidos">
            {predefined.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        )}
        {own.length > 0 && (
          <optgroup label="Da equipa">
            {own.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        )}
      </select>
    </div>
  );
}

/** Pesquisa por nome, telefone ou email e junta à lista (máx. 200). */
function PeoplePicker({ value, onChange }: { value: Picked[]; onChange: (v: Picked[]) => void }) {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);
  const results = useResource<Page<AdminUserSummary>>(q.length >= 2 ? `admin:msg-users:${q}` : null, () => adminApi.users(q, false, 0, 8));
  const chosen = new Set(value.map((p) => p.id));
  const full = value.length >= 200;

  return (
    <div className="grid gap-3">
      <label className="relative">
        <span className="sr-only">Procurar pessoas</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
        <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nome, telefone ou email" maxLength={100} className={cn(inputClass, "pl-12")} />
      </label>

      {q.length >= 2 && (
        <div className="rounded-campo border border-borda">
          {results.error ? (
            <ErrorState message={results.error} onRetry={results.reload} className="py-4" />
          ) : !results.data ? (
            <p role="status" className="p-3 text-sm text-cinza">A procurar…</p>
          ) : results.data.content.length === 0 ? (
            <p className="p-3 text-sm text-cinza">Ninguém encontrado.</p>
          ) : (
            <ul aria-label="Resultados">
              {results.data.content.map((u) => (
                <li key={u.id} className="flex items-center gap-3 border-b border-borda px-3 py-2 last:border-0">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium text-verde">{u.fullName}</span>
                    <span className="truncate text-[13px] text-cinza">{u.phone}{u.email && ` · ${u.email}`}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={chosen.has(u.id) || full}
                    onClick={() => onChange([...value, { id: u.id, fullName: u.fullName, phone: u.phone }])}
                    aria-label={`Adicionar ${u.fullName}`}
                  >
                    {chosen.has(u.id) ? "Adicionada" : <><Plus strokeWidth={1.8} aria-hidden /> Adicionar</>}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm text-cinza">{value.length} {value.length === 1 ? "pessoa escolhida" : "pessoas escolhidas"}{full && " (máximo 200)"}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Pessoas escolhidas">
            {value.map((p) => (
              <li key={p.id} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-salvia-tint pr-1 pl-3 text-sm text-verde">
                {p.fullName}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                  aria-label={`Remover ${p.fullName}`}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-white/60"
                >
                  <X className="size-4" strokeWidth={1.8} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Verificar WhatsApp ───────────────────────────────────────────────────
/** Aceita 9 dígitos angolanos ou formato internacional (+…). */
function toE164(input: string) {
  const raw = input.replace(/[\s().-]/g, "");
  if (/^9\d{8}$/.test(raw)) return `+244${raw}`;
  if (/^00\d{6,15}$/.test(raw)) return `+${raw.slice(2)}`;
  if (/^\+\d{6,15}$/.test(raw)) return raw;
  return null;
}

export function WhatsAppCheckCard() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<WhatsAppCheck | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const n = toE164(phone);
    if (!n) return setError("Escreve 9 dígitos (923…) ou o número com indicativo (+351…).");
    setBusy(true);
    setError(undefined);
    setResult(null);
    try {
      setResult(await adminMessageApi.whatsappCheck(n));
    } catch (err) {
      setError(errorText(err, "Não foi possível verificar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid content-start gap-3 p-5 lg:sticky lg:top-6">
      <h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-verde">
        <MessageCircle className="size-5 text-mel" strokeWidth={1.8} aria-hidden /> Verificar WhatsApp
      </h2>
      <p className="text-sm text-cinza">Antes de mandar por WhatsApp, confirma se o número o tem.</p>
      <form onSubmit={check} className="grid gap-3" noValidate>
        <TextField label="Telefone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={setPhone} placeholder="+244 923 000 000" error={error} maxLength={20} />
        <Button type="submit" variant="outline" loading={busy}>Verificar</Button>
      </form>
      {result && (
        <div role="status" className="grid gap-1 rounded-campo bg-areia p-3 text-sm">
          <p className="num font-bold text-verde">{result.phone}</p>
          {result.hasWhatsApp === null ? (
            <p className="text-aviso-texto">Não foi possível verificar agora: o serviço de WhatsApp não respondeu. Tenta daqui a pouco.</p>
          ) : result.hasWhatsApp ? (
            <Badge tone="ok" className="justify-self-start">Tem WhatsApp</Badge>
          ) : (
            <Badge tone="erro" className="justify-self-start">Sem WhatsApp</Badge>
          )}
          {result.international && <p className="text-cinza">Número estrangeiro: só recebe por WhatsApp (o SMS não chega).</p>}
        </div>
      )}
    </Card>
  );
}

// ── Histórico ────────────────────────────────────────────────────────────
export function MessageHistory() {
  const [page, setPage] = useState(0);
  const list = useResource<Page<AdminMessageSummary>>(`admin:messages:${page}`, () => adminMessageApi.list(page));
  const totalPages = list.data?.page?.totalPages ?? list.data?.totalPages ?? 1;

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <div className="p-4"><ListSkeleton rows={4} label="A carregar envios" /></div>
        ) : list.data.content.length === 0 ? (
          <EmptyState icon={Send} title="Ainda sem envios" text="As mensagens que mandares aparecem aqui, com o estado de cada entrega." />
        ) : (
          <ul aria-label="Envios">
            {list.data.content.map((m) => {
              const Icon = CHANNEL_ICON[m.channel];
              return (
                <li key={m.id} className="border-b border-borda last:border-0">
                  <Link href={`/admin/mensagens/${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-areia focus-visible:bg-areia focus-visible:outline-none">
                    <Icon className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-label={CHANNEL_LABEL[m.channel]} />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate font-bold text-verde">{m.subject || m.bodyPreview}</span>
                      <span className="text-[13px] text-cinza">
                        {m.audienceLabel} · {formatDateTime(m.createdAt)} · {m.createdBy}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone="ok">{m.sent} enviadas</Badge>
                        {m.pending > 0 && <Badge tone="pendente">{m.pending} por enviar</Badge>}
                        {m.failed > 0 && <Badge tone="erro">{m.failed} falharam</Badge>}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {totalPages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm text-cinza">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Seguinte</Button>
        </nav>
      )}
    </div>
  );
}

// ── Modelos ──────────────────────────────────────────────────────────────
export function TemplatesManager() {
  const templates = useResource<MessageTemplate[]>("admin:msg-templates", () => adminMessageApi.templates());
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string>();

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteErr(undefined);
    try {
      await adminMessageApi.deleteTemplate(deleting.id);
      toast.success("Modelo apagado.");
      setDeleting(null);
      templates.reload();
    } catch (e) {
      setDeleteErr(
        e instanceof ApiError && e.code === "predefined_template" ? "Os modelos predefinidos não se apagam." : errorText(e, "Não foi possível apagar."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="dark" size="sm" onClick={() => setEditing("new")}>
          <Plus strokeWidth={1.8} aria-hidden /> Novo modelo
        </Button>
      </div>
      <Card className="overflow-hidden">
        {templates.error ? (
          <ErrorState message={templates.error} onRetry={templates.reload} />
        ) : !templates.data ? (
          <div className="p-4"><ListSkeleton rows={3} label="A carregar modelos" /></div>
        ) : templates.data.length === 0 ? (
          <EmptyState icon={FileText} title="Ainda sem modelos" text="Cria um modelo para as mensagens que mandas muitas vezes." />
        ) : (
          <ul aria-label="Modelos">
            {templates.data.map((t) => (
              <li key={t.id} className="grid gap-2 border-b border-borda px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-verde">{t.name}</span>
                  {t.predefined ? <Badge tone="escuro">Predefinido</Badge> : <Badge tone="analise">Da equipa</Badge>}
                  <Badge tone="neutro">{t.channel ? CHANNEL_LABEL[t.channel] : "Qualquer canal"}</Badge>
                  {!t.predefined && (
                    <span className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}>
                        <Pencil strokeWidth={1.8} aria-hidden /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-erro" onClick={() => setDeleting(t)} aria-label={`Apagar ${t.name}`}>
                        <Trash2 strokeWidth={1.8} aria-hidden /> Apagar
                      </Button>
                    </span>
                  )}
                </div>
                {t.subject && <p className="text-sm"><b>Assunto:</b> {t.subject}</p>}
                <p className="line-clamp-3 text-sm whitespace-pre-line text-cinza">{t.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TemplateSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          templates.reload();
        }}
      />

      <Sheet
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setDeleteErr(undefined);
        }}
        title={`Apagar "${deleting?.name ?? ""}"?`}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" block loading={busy} onClick={remove}>Apagar modelo</Button>
          </div>
        }
      >
        <div className="grid gap-3 pt-2">
          <p>Os envios já feitos com este modelo continuam no histórico.</p>
          <FormError message={deleteErr} />
        </div>
      </Sheet>
    </div>
  );
}

type ChannelChoice = "" | MessageChannel;

function TemplateSheet({ template, onClose, onSaved }: { template: MessageTemplate | "new" | null; onClose: () => void; onSaved: () => void }) {
  const t = template && template !== "new" ? template : null;
  const [name, setName] = useState(t?.name ?? "");
  const [channel, setChannel] = useState<ChannelChoice>(t?.channel ?? "");
  const [subject, setSubject] = useState(t?.subject ?? "");
  const [body, setBody] = useState(t?.body ?? "");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [busy, setBusy] = useState(false);

  async function save() {
    const fields: Record<string, string> = {};
    if (!name.trim()) fields.name = "Dá um nome ao modelo.";
    if (!body.trim()) fields.body = "Escreve o texto.";
    if (Object.keys(fields).length) return setErrors({ fields });
    setBusy(true);
    setErrors({ fields: {} });
    const input = {
      name: name.trim(),
      body: body.trim(),
      channel: channel || undefined,
      subject: channel === "" || channel === "EMAIL" ? subject.trim() || undefined : undefined,
    };
    try {
      if (t) await adminMessageApi.updateTemplate(t.id, input);
      else await adminMessageApi.createTemplate(input);
      toast.success("Modelo guardado.");
      onSaved();
    } catch (e) {
      setErrors(
        e instanceof ApiError && e.code === "predefined_template" ? { form: "Os modelos predefinidos não se editam.", fields: {} } : toFormErrors(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={template !== null}
      onClose={onClose}
      title={t ? `Editar "${t.name}"` : "Novo modelo"}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="dark" block loading={busy} onClick={save}>Guardar modelo</Button>
        </div>
      }
    >
      <div className="grid gap-4 pt-2">
        <TextField label="Nome" value={name} onChange={setName} maxLength={80} error={errors.fields.name} placeholder="Ex.: KYC parado há 3 dias" />
        <SelectField
          label="Canal"
          value={channel}
          onChange={(v) => setChannel(v as ChannelChoice)}
          options={[
            { value: "", label: "Qualquer canal" },
            { value: "EMAIL", label: "Email" },
            { value: "WHATSAPP", label: "WhatsApp" },
            { value: "SMS", label: "SMS" },
          ]}
        />
        {(channel === "" || channel === "EMAIL") && (
          <TextField label="Assunto (email)" value={subject} onChange={setSubject} maxLength={150} error={errors.fields.subject} />
        )}
        <TextArea
          label="Texto"
          value={body}
          onChange={setBody}
          rows={6}
          maxLength={BODY_MAX}
          error={errors.fields.body}
          hint={`${body.length}/${BODY_MAX}. Usa {{nome}} ou {{primeiro_nome}} para personalizar.`}
        />
        <FormError message={errors.form} />
      </div>
    </Sheet>
  );
}
