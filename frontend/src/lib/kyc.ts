import { ApiError } from "./api";
import { docT } from "./i18n";

/**
 * A API recusa publicar, reativar e pedir reserva sem identidade verificada (KycService.assertCanTransact, 403).
 * Quem recebe este erro vai para /verificacao em vez de ver só a mensagem.
 */
export function isKycRequired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && /identidade/i.test(e.message);
}

/** Texto do toast na língua da página (lido quando é mostrado). */
export function kycRedirectToast() {
  return docT().kyc.redirectToast;
}
