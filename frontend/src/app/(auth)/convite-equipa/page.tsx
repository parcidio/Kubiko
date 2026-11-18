"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserX } from "lucide-react";
import { AuthTitle } from "@/components/bz/auth";
import { FormError } from "@/components/bz/form";
import { EmptyState, ListSkeleton } from "@/components/bz/states";
import { Button, ButtonLink, Callout } from "@/components/bz/ui";
import { ApiError } from "@/lib/api";
import { ADMIN_CONFLICT, ADMIN_ROLE_LABEL, ADMIN_ROLE_SCOPE, teamInviteApi, type InvitationPreview } from "@/lib/api-admin";
import { signOut, useSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

/**
 * Aceitar um convite para a equipa (decisoes-produto.md 2026-11-18).
 * O token chega no fragmento (#…): o browser não o envia a servidores. Guardamo-lo na sessão do separador para
 * sobreviver ao "entra primeiro" e tiramo-lo do URL. Vai para a API só no corpo de um POST.
 */
const TOKEN_KEY = "beeznoo.convite-equipa";

function readToken(): string | null {
  try {
    const fromHash = window.location.hash.replace(/^#/, "").trim();
    if (fromHash) {
      sessionStorage.setItem(TOKEN_KEY, fromHash);
      window.history.replaceState(null, "", window.location.pathname);
      return fromHash;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem storage */
  }
}

function problemText(code: string | null | undefined, fallback: string) {
  return (code && ADMIN_CONFLICT[code]) || fallback;
}

export default function TeamInvitePage() {
  const router = useRouter();
  const session = useSession();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | undefined>();

  useEffect(() => {
    // o fragmento só existe no browser: ler depois de montar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readToken());
  }, []);

  const load = useCallback(async (t: string) => {
    setLoadError(null);
    setPreview(null);
    try {
      setPreview(await teamInviteApi.inspect(t));
    } catch (e) {
      setLoadError(e instanceof ApiError ? problemText(e.code, e.message) : "Não foi possível abrir o convite.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token && session) void load(token);
  }, [token, session, load]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    setAcceptError(undefined);
    try {
      await teamInviteApi.accept(token);
      forgetToken();
      // o papel vai no token de acesso: a API revogou as sessões; volta a entrar, agora com o 2FA da equipa
      await signOut();
      router.replace("/entrar?next=/admin");
    } catch (e) {
      setAcceptError(e instanceof ApiError ? problemText(e.code, e.message) : "Não foi possível aceitar o convite.");
    } finally {
      setAccepting(false);
    }
  }

  if (token === undefined || session === undefined) {
    return <ListSkeleton rows={2} label="A abrir o convite" />;
  }

  if (!token) {
    return (
      <EmptyState
        icon={UserX}
        title="Link incompleto"
        text="Abre o link do convite tal como o recebeste. Se não funcionar, pede um convite novo à equipa."
        className="px-0"
      />
    );
  }

  if (!session) {
    return (
      <>
        <AuthTitle title="Convite para a equipa" subtitle="Entra com a conta que foi convidada para veres e aceitares o convite." />
        <div className="grid gap-3">
          <ButtonLink href="/entrar?next=/convite-equipa" block size="lg">
            Entrar
          </ButtonLink>
          <ButtonLink href="/registar?next=/convite-equipa" variant="secondary" block size="lg">
            Criar conta
          </ButtonLink>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={UserX}
        title="Não dá para usar este convite"
        text={loadError}
        action={<Button variant="secondary" onClick={() => load(token)}>Tentar outra vez</Button>}
        className="px-0"
      />
    );
  }

  if (!preview) return <ListSkeleton rows={2} label="A abrir o convite" />;

  return (
    <>
      <AuthTitle
        title="Convite para a equipa"
        subtitle={`${preview.invitedByName} convidou-te para o Admin da Beeznoo. Válido até ${formatDateTime(preview.expiresAt)}.`}
      />
      <div className="grid gap-5">
        <div className="rounded-2xl border border-linha p-4">
          <p className="text-sm text-cinza">Papel</p>
          <p className="font-titulo text-lg font-bold text-verde">{ADMIN_ROLE_LABEL[preview.adminRole]}</p>
          <p className="mt-1 text-[15px] text-cinza">{ADMIN_ROLE_SCOPE[preview.adminRole]}</p>
        </div>
        {preview.problem ? (
          <Callout tone="erro" icon={UserX}>
            {problemText(preview.problem, "Não podes aceitar este convite.")}
          </Callout>
        ) : (
          <>
            <Callout icon={ShieldCheck}>
              Ao aceitar, sais da sessão e voltas a entrar. A partir daí, cada entrada pede um código por WhatsApp.
            </Callout>
            <FormError message={acceptError} />
            <Button onClick={accept} loading={accepting} block size="lg">
              {accepting ? "A aceitar…" : "Aceitar convite"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
