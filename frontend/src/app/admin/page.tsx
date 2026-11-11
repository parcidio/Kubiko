"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Banknote, Flag, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { Card } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import type { Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const total = (p: Page<unknown>) => p.page?.totalElements ?? p.content.length;

const QUEUES: { href: string; title: string; text: string; icon: LucideIcon; count: () => Promise<number> }[] = [
  { href: "/admin/verificacoes", title: "Verificações pendentes", text: "BI, selfie e NIF para aprovar", icon: BadgeCheck, count: () => adminApi.kycQueue(0, 1).then(total) },
  { href: "/admin/pagamentos", title: "Pagamentos a validar", text: "Referências em aberto", icon: Banknote, count: () => adminApi.payments(0, 1).then(total) },
  { href: "/admin/caucoes", title: "Cauções a libertar ou reter", text: "Depois da devolução ou de um problema", icon: ShieldCheck, count: () => adminApi.deposits(0, 1).then(total) },
  { href: "/admin/problemas", title: "Problemas reportados", text: "Dano, perda, roubo", icon: Flag, count: () => adminApi.incidents(0, 1).then(total) },
];

export default function AdminHome() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Visão geral" text="Quatro filas, o mais antigo primeiro. Cada decisão pede motivo e fica na auditoria." />
      <div className="grid gap-4 sm:grid-cols-2">
        {QUEUES.map((q) => (
          <QueueCard key={q.href} {...q} />
        ))}
      </div>
      <Link href="/admin/auditoria" className="group">
        <Card className="flex items-center gap-4 p-5 transition group-hover:border-verde">
          <span className="flex size-11 items-center justify-center rounded-full bg-areia-2 text-mel">
            <ScrollText className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-bold text-verde">Auditoria e segurança</p>
            <p className="text-sm text-cinza">Quem fez o quê e quando; logins, 2FA e sessões suspeitas.</p>
          </div>
          <ArrowRight className="size-5 text-cinza transition group-hover:translate-x-1 group-hover:text-verde" strokeWidth={1.8} aria-hidden />
        </Card>
      </Link>
    </div>
  );
}

function QueueCard({ href, title, text, icon: Icon, count }: (typeof QUEUES)[number]) {
  const n = useResource<number>(`admin:count:${href}`, count);
  return (
    <Link href={href} className="group">
      <Card className="grid gap-4 p-5 transition group-hover:border-verde">
        <div className="flex items-center justify-between">
          <span className="flex size-11 items-center justify-center rounded-full bg-verde text-ambar">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <ArrowRight className="size-5 text-cinza transition group-hover:translate-x-1 group-hover:text-verde" strokeWidth={1.8} aria-hidden />
        </div>
        <div>
          <p className="num font-titulo text-4xl font-extrabold text-verde" aria-live="polite">
            {n.data !== undefined ? n.data : n.error ? <span title={n.error}>—</span> : <span role="status" aria-label="A carregar" className="text-borda-forte">·</span>}
          </p>
          <p className="font-bold text-verde">{title}</p>
          <p className="text-sm text-cinza">{text}</p>
        </div>
      </Card>
    </Link>
  );
}
