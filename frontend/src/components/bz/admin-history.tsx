"use client";

import { ScrollText } from "lucide-react";
import { EmptyState } from "./states";
import { ACTION_LABEL, ENTITY_LABEL } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

/** Histórico (audit_logs) em lista cronológica: quando, quem, o quê, motivo. */
export function AuditTimeline({ entries, emptyText = "Ainda não há decisões registadas." }: { entries: AuditLog[]; emptyText?: string }) {
  if (entries.length === 0) return <EmptyState icon={ScrollText} title="Sem histórico" text={emptyText} className="py-8" />;
  return (
    <ol className="grid">
      {entries.map((a) => (
        <li key={a.id} className="grid gap-0.5 border-b border-borda px-4 py-3 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <time dateTime={a.createdAt} className="num text-[13px] text-cinza">{formatDateTime(a.createdAt)}</time>
          <div className="grid gap-0.5">
            <p className="text-sm">
              <span className="font-bold text-verde">{ACTION_LABEL[a.action] ?? a.action}</span>
              <span className="text-cinza"> · {ENTITY_LABEL[a.entityType] ?? a.entityType} · {a.actorName}</span>
            </p>
            {a.reason && <p className="text-sm whitespace-pre-line text-texto-corpo">Motivo: {a.reason}</p>}
            <Meta metadata={a.metadata} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const META_LABEL: Record<string, string> = { from: "de", to: "para", adminRole: "papel", sessions: "sessões" };

// só os campos que ajudam a ler a decisão (ids técnicos ficam de fora)
function Meta({ metadata }: { metadata: Record<string, unknown> }) {
  const shown = Object.entries(metadata ?? {}).filter(([k, v]) => META_LABEL[k] && (typeof v === "string" || typeof v === "number"));
  if (shown.length === 0) return null;
  return (
    <p className="text-xs text-cinza">
      {shown.map(([k, v]) => `${META_LABEL[k]}: ${String(v)}`).join(" · ")}
    </p>
  );
}
