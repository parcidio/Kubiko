"use client";

import { useState } from "react";
import { ShieldCheck, ShieldMinus } from "lucide-react";
import { FormError } from "./form";
import { Sheet, toast } from "./overlay";
import { Button } from "./ui";
import { ApiError } from "@/lib/api";
import { adminRoleApi } from "@/lib/api-ops";

/** Admin › Utilizadores: dar/retirar o papel de admin (decisoes-produto.md 2026-11-17, ponto 1). */

const CONFLICT: Record<string, string> = {
  last_admin: "É a última pessoa com acesso de admin. Dá acesso a outra pessoa antes de retirar este.",
  self_demotion: "Não podes retirar o teu próprio acesso de admin. Pede a outra pessoa da equipa.",
  account_suspended: "Esta conta está suspensa. Reativa-a antes de lhe dar acesso de admin.",
};

export function roleErrorMessage(e: unknown) {
  if (e instanceof ApiError && e.status === 409 && e.code && CONFLICT[e.code]) return CONFLICT[e.code];
  return e instanceof Error ? e.message : "Não foi possível mudar o acesso.";
}

export type RoleTarget = { id: string; fullName: string; makeAdmin: boolean };

/** Confirmação em <dialog> (Sheet). Ao retirar admin, a conta volta a "dono e arrendatário". */
export function RoleChangeSheet({ target, onClose, onDone }: { target: RoleTarget | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const makeAdmin = target?.makeAdmin ?? true;

  function close() {
    setError(undefined);
    onClose();
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      await adminRoleApi.setAdmin(target.id, target.makeAdmin);
      toast.success(target.makeAdmin ? `${target.fullName} já faz parte da equipa.` : `${target.fullName} deixou de ter acesso ao Admin.`);
      onDone();
      close();
    } catch (e) {
      setError(roleErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={target !== null}
      onClose={close}
      title={makeAdmin ? `Tornar ${target?.fullName ?? ""} admin?` : `Retirar admin a ${target?.fullName ?? ""}?`}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant={makeAdmin ? "dark" : "danger"} block loading={busy} onClick={confirm}>
            {makeAdmin ? <ShieldCheck strokeWidth={1.8} aria-hidden /> : <ShieldMinus strokeWidth={1.8} aria-hidden />}
            {makeAdmin ? "Tornar admin" : "Retirar admin"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 pt-2 text-[15px]">
        {makeAdmin ? (
          <>
            <p>Passa a ver e decidir tudo no Admin: verificações, pagamentos, cauções, utilizadores e mensagens.</p>
            <p className="text-sm text-cinza">
              Ao entrar, passa a pedir um código por WhatsApp ou SMS. A mudança fica registada na auditoria.
            </p>
          </>
        ) : (
          <>
            <p>Perde o acesso ao Admin e a conta volta a &quot;dono e arrendatário&quot;.</p>
            <p className="text-sm text-cinza">A mudança fica registada na auditoria.</p>
          </>
        )}
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
