"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, Users } from "lucide-react";
import { AdminHeader, AdminPanel, age } from "@/components/bz/admin";
import { KycBadge, RoleLabel } from "@/components/bz/admin-users";
import {
  DataTable, DateFilter, FilterSelect, Pagination, SearchInput, SortTh, TableSkeleton, Td, Th, Toolbar, Tr, pageTotal,
} from "@/components/bz/admin-table";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { Badge, Button } from "@/components/bz/ui";
import { ADMIN_ROLE_LABEL, adminUsersApi, type KycFilter, type UserFilters, type UserSort } from "@/lib/api-admin";
import { formatDay } from "@/lib/format";
import type { AdminUserSummary, Page, UserRole } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const PAGE_SIZE = 25;
const ROLES: { value: UserRole; label: string }[] = [
  { value: "OWNER", label: "Dono" },
  { value: "RENTER", label: "Arrendatário" },
  { value: "BOTH", label: "Dono e arrendatário" },
  { value: "ADMIN", label: "Equipa" },
];
const KYCS: { value: KycFilter; label: string }[] = [
  { value: "NONE", label: "Sem KYC" },
  { value: "PENDING", label: "Por analisar" },
  { value: "IN_REVIEW", label: "Em análise" },
  { value: "INFO_REQUESTED", label: "Falta informação" },
  { value: "APPROVED", label: "Verificado" },
  { value: "REJECTED", label: "Recusado" },
];
const STATUSES: { value: "ACTIVE" | "SUSPENDED"; label: string }[] = [
  { value: "ACTIVE", label: "Ativas" },
  { value: "SUSPENDED", label: "Suspensas" },
];
const PHONE: { value: "yes" | "no"; label: string }[] = [
  { value: "yes", label: "Confirmado" },
  { value: "no", label: "Por confirmar" },
];

/** Admin › Confiança › Utilizadores: pesquisa, filtros, ordenação e paginação no servidor. O estado vive no URL. */
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

  const f: UserFilters = {
    q: params.get("q") ?? "",
    role: (params.get("papel") as UserRole) || undefined,
    kyc: (params.get("kyc") as KycFilter) || undefined,
    status: (params.get("estado") as UserFilters["status"]) || undefined,
    phoneVerified: params.get("telefone") === "yes" ? true : params.get("telefone") === "no" ? false : undefined,
    createdFrom: params.get("de") ?? undefined,
    createdTo: params.get("ate") ?? undefined,
    sort: (params.get("ordem") as UserSort) || "createdAt",
    direction: params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : undefined,
    page: Math.max(0, Number(params.get("p") ?? 0) || 0),
    size: PAGE_SIZE,
  };
  const direction = f.direction ?? (f.sort === "name" ? "asc" : "desc");
  const [draft, setDraft] = useState(f.q ?? "");

  function set(next: Record<string, string | undefined>, resetPage = true) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (resetPage) sp.delete("p");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  // pesquisa 300 ms depois de parar de escrever
  useEffect(() => {
    if (draft === (f.q ?? "")) return;
    const t = setTimeout(() => set({ q: draft.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const key = JSON.stringify(f);
  const users = useResource<Page<AdminUserSummary>>(`admin:users:${key}`, () => adminUsersApi.search(f));
  const total = pageTotal(users.data);
  const filtered = !!(f.q || f.role || f.kyc || f.status || f.phoneVerified !== undefined || f.createdFrom || f.createdTo);

  function sortBy(k: UserSort) {
    if (k === f.sort) set({ dir: direction === "asc" ? "desc" : "asc" }, true);
    else set({ ordem: k === "createdAt" ? undefined : k, dir: undefined });
  }

  return (
    <div className="grid gap-4">
      <AdminHeader
        title="Utilizadores"
        text="Encontra uma conta, abre a ficha e decide. Ações sensíveis pedem motivo e ficam na auditoria."
        meta={users.data ? <span className="num text-sm text-cinza">{total} {total === 1 ? "conta" : "contas"}{filtered ? " com estes filtros" : ""}</span> : undefined}
      />

      <AdminPanel>
        <Toolbar>
          <SearchInput label="Pesquisar utilizadores" value={draft} onChange={setDraft} placeholder="Nome, telefone (3+ dígitos) ou email" />
          <FilterSelect label="Papel" value={f.role ?? ""} onChange={(v) => set({ papel: v || undefined })} options={ROLES} />
          <FilterSelect label="KYC" value={f.kyc ?? ""} onChange={(v) => set({ kyc: v || undefined })} options={KYCS} />
          <FilterSelect label="Conta" value={f.status ?? ""} onChange={(v) => set({ estado: v || undefined })} options={STATUSES} allLabel="Todas" />
          <FilterSelect
            label="Telefone"
            value={f.phoneVerified === undefined ? "" : f.phoneVerified ? "yes" : "no"}
            onChange={(v) => set({ telefone: v || undefined })}
            options={PHONE}
          />
          <DateFilter label="Registo desde" value={f.createdFrom ?? ""} max={f.createdTo} onChange={(v) => set({ de: v || undefined })} />
          <DateFilter label="até" value={f.createdTo ?? ""} min={f.createdFrom} onChange={(v) => set({ ate: v || undefined })} />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-10"
              onClick={() => {
                setDraft("");
                router.replace(pathname, { scroll: false });
              }}
            >
              <FilterX strokeWidth={1.8} /> Limpar
            </Button>
          )}
        </Toolbar>

        {users.error ? (
          <ErrorState message={users.error} onRetry={users.reload} className="py-10" />
        ) : !users.data ? (
          <TableSkeleton label="A carregar utilizadores" />
        ) : users.data.content.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? "Ninguém com estes filtros" : "Ainda sem utilizadores"}
            text={filtered ? "Experimenta parte do nome, os últimos dígitos do telefone, ou limpa os filtros." : "Quando alguém se registar, aparece aqui."}
            className="py-10"
          />
        ) : (
          <>
            <DataTable label="Utilizadores" minWidth={900}>
              <thead>
                <tr>
                  <SortTh label="Nome" sortKey="name" sort={f.sort ?? "createdAt"} direction={direction} onSort={sortBy} />
                  <Th>Contacto</Th>
                  <Th>Papel</Th>
                  <Th>KYC</Th>
                  <Th>Conta</Th>
                  <SortTh label="Equip." sortKey="items" sort={f.sort ?? "createdAt"} direction={direction} onSort={sortBy} align="right" />
                  <Th align="right">Reservas</Th>
                  <SortTh label="Registo" sortKey="createdAt" sort={f.sort ?? "createdAt"} direction={direction} onSort={sortBy} />
                </tr>
              </thead>
              <tbody>
                {users.data.content.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <Link href={`/admin/utilizadores/${u.id}`} className="font-bold text-verde underline-offset-2 hover:underline">
                        {u.fullName}
                      </Link>
                    </Td>
                    <Td className="text-cinza">
                      <span className="num block whitespace-nowrap text-texto-corpo">{u.phone}</span>
                      {u.email && <span className="block max-w-56 truncate text-xs">{u.email}</span>}
                    </Td>
                    <Td>
                      {u.role === "ADMIN" ? (
                        <Badge tone="escuro">{u.adminRole ? ADMIN_ROLE_LABEL[u.adminRole] : "Equipa"}</Badge>
                      ) : (
                        <span className="capitalize"><RoleLabel role={u.role} /></span>
                      )}
                    </Td>
                    <Td><KycBadge status={u.kycStatus} /></Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {u.suspendedAt ? <Badge tone="erro">Suspensa</Badge> : <Badge tone="ok">Ativa</Badge>}
                        {!u.phoneVerified && <Badge tone="pendente">Tel. por confirmar</Badge>}
                      </span>
                    </Td>
                    <Td align="right" className="num">{u.items}</Td>
                    <Td align="right" className="num">{u.bookingsAsRenter + u.bookingsAsOwner}</Td>
                    <Td className="whitespace-nowrap text-cinza">
                      <span className="num">{formatDay(u.createdAt.slice(0, 10))}</span>
                      <span className="block text-xs">{age(u.createdAt)}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
            <Pagination page={f.page ?? 0} size={PAGE_SIZE} total={total} onPage={(p) => set({ p: p > 0 ? String(p) : undefined }, false)} />
          </>
        )}
      </AdminPanel>
    </div>
  );
}
