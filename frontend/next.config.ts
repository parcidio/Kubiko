import type { NextConfig } from "next";

// O browser fala só com o Next (mesma origem); o Next encaminha /api/v1 para o Spring.
// Evita CORS no backend e não expõe o URL interno da API.
const isDev = process.env.NODE_ENV !== "production";
// Sem API_URL: em desenvolvimento usa a API local (nunca a alojada sem dar por isso); em produção mantém a antiga
// omissão, mas avisa no build — cada ambiente do Vercel deve ter o seu API_URL (docs/DEPLOY.md)
const apiUrl = process.env.API_URL ?? (isDev ? "http://localhost:8081" : "https://beeznoo.onrender.com");
if (!process.env.API_URL && !isDev) {
  console.warn(`[beeznoo] API_URL não definido: o proxy vai para ${apiUrl}. Define-o no ambiente do Vercel.`);
}
// Armazenamento próprio (VPS com Garage/MinIO, ex. https://s3.beeznoo.ao): as fotos e documentos vêm de lá por URL
// assinada, por isso a CSP tem de permitir essa origem. No B2 não é preciso (*.backblazeb2.com já está). Lido no build.
const storageOrigin = (process.env.STORAGE_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");

// Cabeçalhos de segurança (OWASP A02/A05). Ver docs/SEGURANCA.md.
// - imagens: as fotos e documentos vêm de URLs assinadas do Backblaze B2 (*.backblazeb2.com)
// - scripts: o Next precisa de 'unsafe-inline' para os scripts de hidratação (sem nonce no MVP);
//   em desenvolvimento também 'unsafe-eval' (React Refresh)
// - o login Google é uma navegação para /oauth2/... (proxy para a API), não um pedido — não precisa de connect-src externo
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // em desenvolvimento também um S3 local (MinIO/S3Mock, B2_PATH_STYLE=true)
  // tile.openstreetmap.org: mosaicos do mapa em Admin › Mapa (só imagens; o Leaflet vem do nosso bundle)
  `img-src 'self' data: blob: https://*.backblazeb2.com https://tile.openstreetmap.org${storageOrigin ? ` ${storageOrigin}` : ""}${isDev ? " http://localhost:*" : ""}`,
  "font-src 'self' data:",
  // ws:/localhost só em desenvolvimento (React Refresh). (A lista de espera, que usava o Google Apps Script, saiu.)
  `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// geolocation=(self): localização aproximada com consentimento (registo, KYC, publicar) — decisoes-produto.md 2026-11-17
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Imagem Docker (VPS, frontend/Dockerfile): servidor Node autónomo. O Vercel não precisa disto.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
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
