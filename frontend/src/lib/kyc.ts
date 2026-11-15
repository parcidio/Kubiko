import { ApiError } from "./api";

/**
 * A API recusa publicar, reativar e pedir reserva sem identidade verificada (KycService.assertCanTransact, 403).
 * Quem recebe este erro vai para /verificacao em vez de ver só a mensagem.
 */
export function isKycRequired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && /identidade/i.test(e.message);
}

export const KYC_REDIRECT_TOAST = "Verifica a tua identidade primeiro. É feito à mão e pode demorar até 2 dias úteis.";
