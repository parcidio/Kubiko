import type { AuthResponse, UserRole } from "./types";

// Tokens em localStorage: simples para o MVP. Contrapartida conhecida: vulnerável a XSS.
// Quando houver tempo, mover para cookie httpOnly emitido por um route handler do Next.
const KEY = "beeznoo.session";

export interface Session {
  accessToken: string;
  refreshToken: string;
  profileId: string;
  role: UserRole;
}

function decode(token: string): { sub: string; role: UserRole } {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(payload));
}

export function toSession(res: AuthResponse): Session {
  const { sub, role } = decode(res.accessToken);
  return { accessToken: res.accessToken, refreshToken: res.refreshToken, profileId: sub, role };
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
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
