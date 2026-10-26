import type { NextConfig } from "next";

// O browser fala só com o Next (mesma origem); o Next encaminha /api/v1 para o Spring.
// Evita CORS no backend e não expõe o URL interno da API.
const apiUrl = process.env.API_URL ?? "http://localhost:8080";
const isDev = process.env.NODE_ENV !== "production";
// Origem da API quando o browser a chama diretamente (staging); vazio = só o proxy abaixo
const publicApiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";
  } catch {
    return "";
  }
})();

// Cabeçalhos de segurança (OWASP A02/A05). Ver docs/SEGURANCA.md.
// - imagens: as fotos e documentos vêm de URLs assinadas do Backblaze B2 (*.backblazeb2.com)
// - scripts: o Next precisa de 'unsafe-inline' para os scripts de hidratação (sem nonce no MVP);
//   em desenvolvimento também 'unsafe-eval' (React Refresh)
// - o login Google é uma navegação (para a API ou pelo proxy), não um pedido — não precisa de connect-src
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.backblazeb2.com",
  "font-src 'self' data:",
  `connect-src 'self'${publicApiOrigin ? ` ${publicApiOrigin}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` },
      // Login Google pela mesma origem: o callback fica em https://beeznoo.ao/login/oauth2/code/google
      // e o cookie da sessão OAuth2 é do nosso domínio. /oauth2/callback é uma página do Next e não é reescrita.
      { source: "/oauth2/authorization/:path*", destination: `${apiUrl}/oauth2/authorization/:path*` },
      { source: "/login/oauth2/:path*", destination: `${apiUrl}/login/oauth2/:path*` },
    ];
  },
};

export default nextConfig;
