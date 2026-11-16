import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/bz/overlay";
import "./globals.css";

const bricolageGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/BricolageGrotesque-Medium.ttf",
      weight: "500",
    },
    {
      path: "../../public/fonts/BricolageGrotesque-Bold.ttf",
      weight: "700",
    },
    {
      path: "../../public/fonts/BricolageGrotesque-ExtraBold.ttf",
      weight: "800",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/SpaceGrotesk-Bold.ttf",
      weight: "700",
    }
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const dmSans = localFont({
  src: [
    {
      path: "../../public/fonts/DMSans-Regular.ttf",
      weight: "400",
    },
    {
      path: "../../public/fonts/DMSans-Medium.ttf",
      weight: "500",
    },
    {
      path: "../../public/fonts/DMSans-Bold.ttf",
      weight: "700",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

// Pré-visualização dos links (WhatsApp, Facebook, LinkedIn, X): título, descrição e a imagem de app/opengraph-image.tsx.
// metadataBase = URL público do site (SITE_URL no build), para as imagens terem endereço absoluto.
const SITE_DESCRIPTION =
  "Câmaras, som, luzes e projetores de quem os tem parados, perto de ti e com caução reembolsável. Pagas ao dono, na entrega.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://beeznoo.ao"),
  title: { default: "Beeznoo — Aluga o que precisas em Angola", template: "%s" },
  description: SITE_DESCRIPTION,
  applicationName: "Beeznoo",
  openGraph: {
    type: "website",
    siteName: "Beeznoo",
    locale: "pt_PT",
    title: "Beeznoo — Precisas de equipamento? Aluga, não compres.",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beeznoo — Precisas de equipamento? Aluga, não compres.",
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/svg/beeznoo-simbolo.svg", type: "image/svg+xml" },
      { url: "/png/beeznoo-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/png/beeznoo-icon-192.png", sizes: "192x192" }],
  },
};

// Cor da barra do browser no telemóvel (verde da marca)
export const viewport: Viewport = { themeColor: "#0E2A1F" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-PT"
      className={`${bricolageGrotesk.variable} ${spaceGrotesk.variable} ${dmSans.variable} scroll-smooth`}
      // Fontes da app (Identidade Verde v3): font-titulo / font-corpo em globals.css
      style={{ "--bz-display": bricolageGrotesk.style.fontFamily, "--bz-sans": dmSans.style.fontFamily } as React.CSSProperties}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}