import type { NextConfig } from "next";

// O browser fala só com o Next (mesma origem); o Next encaminha /api/v1 para o Spring.
// Evita CORS no backend e não expõe o URL interno da API.
const apiUrl = process.env.API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
