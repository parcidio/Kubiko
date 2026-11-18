import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/bz/overlay";
import { getDict, LOCALE } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { THEME_SCRIPT } from "@/lib/theme-script";
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
// Textos na língua do cookie `lang` (os robots de pré-visualização não o têm: ficam em português).
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const m = getDict(lang).meta;
  return {
    metadataBase: new URL(process.env.SITE_URL || "https://beeznoo.ao"),
    title: { default: m.title, template: "%s" },
    description: m.description,
    applicationName: "Beeznoo",
    openGraph: {
      type: "website",
      siteName: "Beeznoo",
      locale: lang === "en" ? "en_GB" : "pt_PT",
      title: m.ogTitle,
      description: m.description,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: m.ogTitle,
      description: m.description,
    },
    icons: {
      icon: [
        { url: "/svg/beeznoo-simbolo.svg", type: "image/svg+xml" },
        { url: "/png/beeznoo-favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/png/beeznoo-icon-192.png", sizes: "192x192" }],
    },
  };
}

// Cor da barra do browser no telemóvel (verde da marca; no tema escuro do sistema, o fundo escuro da app)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E2A1F" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1A14" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  return (
    <html
      lang={LOCALE[lang]}
      className={`${bricolageGrotesk.variable} ${spaceGrotesk.variable} ${dmSans.variable} scroll-smooth`}
      // Fontes da app (Identidade Verde v3): font-titulo / font-corpo em globals.css
      style={{ "--bz-display": bricolageGrotesk.style.fontFamily, "--bz-sans": dmSans.style.fontFamily } as React.CSSProperties}
      // O script do tema muda class/style do <html> antes de o React hidratar (lib/theme-script.ts)
      suppressHydrationWarning
    >
      <head>
        {/* Tema antes da primeira pintura, em todas as rotas (landing, autenticação, app, admin): sem flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <I18nProvider lang={lang}>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}