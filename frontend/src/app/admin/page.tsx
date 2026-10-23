import Link from "next/link";
import { ArrowRight, BadgeCheck, Banknote, Flag, ShieldCheck } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { BackendPending } from "@/components/bz/states";
import { Card } from "@/components/bz/ui";

const QUEUES = [
  { href: "/admin/verificacoes", title: "Verificações pendentes", text: "BI, selfie e NIF para aprovar", icon: BadgeCheck },
  { href: "/admin/pagamentos", title: "Pagamentos a validar", text: "Comprovativos e referências", icon: Banknote },
  { href: "/admin/caucoes", title: "Cauções a libertar ou reter", text: "Depois da devolução", icon: ShieldCheck },
  { href: "/admin/problemas", title: "Problemas reportados", text: "Dano, perda, roubo", icon: Flag },
];

export default function AdminHome() {
  return (
    <div className="grid max-w-5xl gap-6">
      <AdminHeader title="Visão geral" text="Quatro filas, o mais antigo primeiro. Cada decisão pede motivo." />
      <div className="grid gap-4 sm:grid-cols-2">
        {QUEUES.map(({ href, title, text, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="grid gap-4 p-5 transition group-hover:border-verde">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-full bg-verde text-ambar">
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <ArrowRight className="size-5 text-cinza transition group-hover:translate-x-1 group-hover:text-verde" strokeWidth={1.8} aria-hidden />
              </div>
              <div>
                <p className="num font-titulo text-4xl font-extrabold text-verde">—</p>
                <p className="font-bold text-verde">{title}</p>
                <p className="text-sm text-cinza">{text}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <BackendPending what="Os contadores precisam de endpoints de listagem para admin (ver docs/BACKEND_GAPS.md)." />
    </div>
  );
}
