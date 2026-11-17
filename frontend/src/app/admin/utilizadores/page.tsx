"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, ShieldCheck, UserX, Users } from "lucide-react";
import { AdminHeader, age } from "@/components/bz/admin";
import { KycBadge, RoleLabel } from "@/components/bz/admin-users";
import { RoleChangeSheet, type RoleTarget } from "@/components/bz/admin-role";
import { inputClass } from "@/components/bz/form";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { Badge, Button, Card } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { useSession } from "@/lib/auth";
import type { AdminUserSummary, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
type Filter = "all" | "suspended" | "admins";

/** Admin › Utilizadores: pesquisa por nome, telefone ou email (decisoes-produto.md 2026-11-15). */
export default function UtilizadoresPage() {
  return (
    <Suspense>
      <Utilizadores />
    </Suspense>
  );
}

function Utilizadores() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const filtro = params.get("filtro");
  const filter: Filter = filtro === "suspensas" ? "suspended" : filtro === "admins" ? "admins" : "all";
  const me = useSession()?.profileId;
  const [roleTarget, setRoleTarget] = useState<RoleTarget | null>(null);
  const page = Math.max(0, Number(params.get("p") ?? 0) || 0);
  const [draft, setDraft] = useState(q);

  // pesquisa 300 ms depois de parar de escrever; o estado fica no URL (voltar atrás e partilhar o link funcionam)
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => go({ q: draft, p: 0 }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function go(next: { q?: string; filtro?: Filter; p?: number }) {
    const sp = new URLSearchParams(params.toString());
    const qq = next.q ?? q;
    const ff = next.filtro ?? filter;
    const pp = next.p ?? page;
    if (qq) sp.set("q", qq);
    else sp.delete("q");
    if (ff === "suspended") sp.set("filtro", "suspensas");
    else if (ff === "admins") sp.set("filtro", "admins");
    else sp.delete("filtro");
    if (pp > 0) sp.set("p", String(pp));
    else sp.delete("p");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  const users = useResource<Page<AdminUserSummary>>(`admin:users:${q}:${filter}:${page}`, () =>
    adminApi.users(q, filter === "suspended", page, PAGE_SIZE, filter === "admins"),
  );
  const total = users.data?.page?.totalElements ?? users.data?.content.length ?? 0;
  const totalPages = users.data?.page?.totalPages ?? users.data?.totalPages ?? 1;

  return (
    <div className="grid max-w-5xl gap-5">
      <AdminHeader title="Utilizadores" text="Procura por nome, telefone ou email. Abre a ficha para ver equipamento, reservas e suspender." />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-72">
          <span className="sr-only">Pesquisar utilizadores</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nome, 923 000 000 ou email"
            maxLength={100}
            className={cn(inputClass, "pl-12")}
          />
        </label>
        <Segmented<Filter>
          label="Filtrar contas"
          value={filter}
          onChange={(v) => go({ filtro: v, p: 0 })}
          options={[
            { value: "all", label: "Todas" },
            { value: "suspended", label: "Suspensas" },
            { value: "admins", label: "Só admins" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {users.error ? (
          <ErrorState message={users.error} onRetry={users.reload} />
        ) : !users.data ? (
          <div className="p-4"><ListSkeleton rows={5} label="A carregar utilizadores" /></div>
        ) : users.data.content.length === 0 ? (
          <EmptyState
            icon={filter === "suspended" ? UserX : filter === "admins" ? ShieldCheck : Users}
            title={q ? "Ninguém encontrado" : filter === "suspended" ? "Nenhuma conta suspensa" : filter === "admins" ? "Sem admins" : "Ainda sem utilizadores"}
            text={q ? "Experimenta parte do nome, os últimos dígitos do telefone ou o email." : "Quando alguém se registar, aparece aqui."}
          />
        ) : (
          <ul aria-label={`${total} ${total === 1 ? "utilizador" : "utilizadores"}`}>
            {users.data.content.map((u) => (
              <li key={u.id} className="flex items-center border-b border-borda last:border-0">
                <Link
                  href={`/admin/utilizadores/${u.id}`}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-areia focus-visible:bg-areia focus-visible:outline-none"
                >
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-verde">{u.fullName}</span>
                      {u.role === "ADMIN" && <Badge tone="escuro" icon={ShieldCheck}>Admin</Badge>}
                      {u.suspendedAt && <Badge tone="erro">Suspensa</Badge>}
                      <KycBadge status={u.kycStatus} />
                    </span>
                    <span className="text-[13px] text-cinza">
                      {u.phone}
                      {u.email && ` · ${u.email}`} · <RoleLabel role={u.role} /> · registo {age(u.createdAt)}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-[13px] text-cinza sm:block">
                    {u.items} equip. · {u.bookingsAsRenter + u.bookingsAsOwner} reservas
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />
                </Link>
                {u.id !== me && !(u.role !== "ADMIN" && u.suspendedAt) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("mr-2 shrink-0", u.role === "ADMIN" && "text-erro")}
                    aria-label={`${u.role === "ADMIN" ? "Retirar admin a" : "Tornar admin"} ${u.fullName}`}
                    onClick={() => setRoleTarget({ id: u.id, fullName: u.fullName, makeAdmin: u.role !== "ADMIN" })}
                  >
                    {u.role === "ADMIN" ? "Retirar admin" : "Tornar admin"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {totalPages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => go({ p: page - 1 })}>Anterior</Button>
          <span className="text-sm text-cinza">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => go({ p: page + 1 })}>Seguinte</Button>
        </nav>
      )}

      <RoleChangeSheet target={roleTarget} onClose={() => setRoleTarget(null)} onDone={users.reload} />
    </div>
  );
}
