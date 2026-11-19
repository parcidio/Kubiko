"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { AdminHeader, AdminPanel, BookingStatusBadge, age } from "@/components/bz/admin";
import { DataTable, FilterSelect, Pagination, SearchInput, TableSkeleton, Td, Th, Toolbar, Tr, pageTotal } from "@/components/bz/admin-table";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { Kz } from "@/components/bz/ui";
import { adminBookingsApi, type AdminBookingRow } from "@/lib/api-admin";
import { BOOKING_LABEL, bookingCode } from "@/lib/booking";
import { formatRange } from "@/lib/format";
import type { BookingStatus, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const STATUSES = Object.keys(BOOKING_LABEL) as BookingStatus[];

/** Admin › Operação › Reservas: todas as reservas, mais recentes primeiro (decisoes-produto.md 2026-11-18). */
export default function ReservasPage() {
  return (
    <Suspense>
      <Reservas />
    </Suspense>
  );
}

function Reservas() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawStatus = params.get("estado");
  const status = rawStatus && STATUSES.includes(rawStatus as BookingStatus) ? (rawStatus as BookingStatus) : undefined;
  const q = params.get("q") ?? "";
  const page = Math.max(0, Number(params.get("p") ?? 0) || 0);
  const [draft, setDraft] = useState(q);

  function set(next: Record<string, string | undefined>, resetPage = true) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (resetPage) sp.delete("p");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => set({ q: draft.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const list = useResource<Page<AdminBookingRow>>(`admin:bookings:${status}:${q}:${page}`, () => adminBookingsApi.list({ status, q, page }));
  const total = pageTotal(list.data);

  return (
    <div className="grid gap-4">
      <AdminHeader
        title="Reservas"
        text="Todas as reservas, das mais recentes para as mais antigas. Abre uma para ver provas, pagamento e histórico."
        meta={list.data ? <span className="num text-sm text-cinza">{total} {total === 1 ? "reserva" : "reservas"}</span> : undefined}
      />
      <AdminPanel>
        <Toolbar>
          <SearchInput label="Pesquisar reservas" value={draft} onChange={setDraft} placeholder="Equipamento, dono ou arrendatário" />
          <FilterSelect<BookingStatus>
            label="Estado"
            value={status ?? ""}
            onChange={(v) => set({ estado: v || undefined })}
            options={STATUSES.map((s) => ({ value: s, label: BOOKING_LABEL[s].label }))}
          />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} className="py-10" />
        ) : !list.data ? (
          <TableSkeleton label="A carregar reservas" />
        ) : list.data.content.length === 0 ? (
          <EmptyState icon={CalendarRange} title={q || status ? "Nenhuma reserva com estes filtros" : "Ainda sem reservas"} className="py-10" />
        ) : (
          <>
            <DataTable label="Reservas" minWidth={920}>
              <thead>
                <tr>
                  <Th>Reserva</Th>
                  <Th>Equipamento</Th>
                  <Th>Arrendatário</Th>
                  <Th>Dono</Th>
                  <Th>Datas</Th>
                  <Th align="right">Total</Th>
                  <Th>Estado</Th>
                  <Th>Criada</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.content.map((b) => (
                  <Tr key={b.id}>
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/reservas/${b.id}`} className="num font-bold text-verde underline-offset-2 hover:underline">
                        {bookingCode(b.id)}
                      </Link>
                    </Td>
                    <Td className="max-w-56 truncate">{b.itemTitle}</Td>
                    <Td><Link href={`/admin/utilizadores/${b.renterId}`} className="hover:underline">{b.renterName}</Link></Td>
                    <Td><Link href={`/admin/utilizadores/${b.ownerId}`} className="hover:underline">{b.ownerName}</Link></Td>
                    <Td className="whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
                    <Td align="right"><Kz value={b.totalPrice} /></Td>
                    <Td><BookingStatusBadge status={b.status} /></Td>
                    <Td className="whitespace-nowrap text-cinza">{age(b.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
            <Pagination page={page} size={25} total={total} onPage={(p) => set({ p: p > 0 ? String(p) : undefined }, false)} />
          </>
        )}
      </AdminPanel>
    </div>
  );
}
