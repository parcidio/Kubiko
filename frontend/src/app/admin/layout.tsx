"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { AdminAccessProvider, AdminSidebar, AdminTopBar, navItemFor } from "@/components/bz/admin-shell";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { ButtonLink, Skeleton } from "@/components/bz/ui";
import { adminAccessApi, type MyAdminAccess } from "@/lib/api-admin";
import { refreshSession } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/mode";
import { useResource } from "@/lib/use-resource";

/**
 * Back-office (decisoes-produto.md 2026-11-18). Desktop primeiro, tablet usável, telemóvel legível.
 * O papel de equipa vem da API (/admin/access/me); a página só aparece com a permissão da área.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireSession();
  // O papel vem do token (15 min). Quem acabou de receber acesso de admin ainda tem um token antigo e, nesta área,
  // nenhum pedido falha com 401 para o renovar: renova uma vez antes de recusar. Se a promoção revogou a sessão,
  // a renovação falha, a sessão local é limpa e useRequireSession leva a pessoa a entrar outra vez (com 2FA).
  const [checked, setChecked] = useState(false);
  const tried = useRef(false);
  const admin = !!session && isAdmin(session.role);
  const needsCheck = !!session && !admin && !checked;
  useEffect(() => {
    if (!needsCheck || tried.current) return;
    tried.current = true;
    refreshSession().finally(() => setChecked(true));
  }, [needsCheck]);

  const access = useResource<MyAdminAccess>(admin ? `admin:access:${session.profileId}` : null, adminAccessApi.me);

  if (!session) return null;
  if (needsCheck) return <div role="status" aria-label="A carregar" className="app min-h-dvh bg-areia" />;
  if (!admin) {
    return (
      <div className="app grid min-h-dvh place-items-center bg-areia p-4">
        <div className="grid justify-items-center gap-2">
          <ErrorState message="Esta área é só para a equipa Beeznoo. O acesso é dado por convite." />
          <ButtonLink href="/explorar" variant="outline">Voltar à app</ButtonLink>
        </div>
      </div>
    );
  }
  if (access.error) {
    return (
      <div className="app grid min-h-dvh place-items-center bg-areia p-4">
        <ErrorState message={access.error} onRetry={access.reload} />
      </div>
    );
  }
  if (!access.data) {
    return (
      <div role="status" aria-label="A carregar o Admin" className="app grid min-h-dvh bg-areia xl:grid-cols-[256px_minmax(0,1fr)]">
        <div className="hidden border-r border-borda bg-branco xl:block" />
        <div className="grid content-start gap-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-cartao" />
        </div>
      </div>
    );
  }

  return (
    <AdminAccessProvider value={access.data}>
      <div className="app min-h-dvh bg-areia xl:grid xl:grid-cols-[256px_minmax(0,1fr)]">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-campo focus:bg-branco focus:px-4 focus:py-2 focus:text-verde">
          Saltar para o conteúdo
        </a>
        <AdminSidebar />
        <div className="min-w-0">
          <AdminTopBar />
          <main id="admin-main" className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-8 md:py-7">
            <Gate permissions={access.data.permissions}>{children}</Gate>
          </main>
        </div>
      </div>
    </AdminAccessProvider>
  );
}

/** Página sem permissão para o papel: explica em vez de mostrar erros 403 em cascata. */
function Gate({ permissions, children }: { permissions: MyAdminAccess["permissions"]; children: React.ReactNode }) {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  if (item && !permissions.includes(item.perm)) {
    return (
      <EmptyState
        icon={Lock}
        title="Sem acesso a esta área"
        text="O teu papel na equipa não inclui esta área. Se precisas, pede a um super admin para mudar o teu papel."
        action={<ButtonLink href="/admin" variant="outline">Ir para a visão geral</ButtonLink>}
      />
    );
  }
  return <>{children}</>;
}
