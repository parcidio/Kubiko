import type { AuthResponse, UserRole } from "./types";

// O refresh token (30 dias) vive num cookie httpOnly emitido pela API (bz_refresh) — fora do alcance de JavaScript.
// Aqui fica só o access token (15 min) e o que se lê dele. Ver docs/SEGURANCA.md.
const KEY = "beeznoo.session";

export interface Session {
  accessToken: string;
  profileId: string;
  role: UserRole;
}

function decode(token: string): { sub: string; role: UserRole } {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(payload));
}

export function toSession(res: AuthResponse): Session {
  if (!res.accessToken) throw new Error("Resposta sem token");
  const { sub, role } = decode(res.accessToken);
  return { accessToken: res.accessToken, profileId: sub, role };
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Session & { refreshToken?: string }) : null;
    if (parsed?.refreshToken) {
      // sessão antiga (refresh em localStorage): limpa-a; a pessoa entra outra vez
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* modo privado: a sessão fica só em memória */
  }
  window.dispatchEvent(new Event("beeznoo:session"));
}
