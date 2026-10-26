import type { Metadata } from "next";
import {  DM_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Beeznoo — Aluga o que precisas em Angola",
  description: "A plataforma que liga quem precisa de equipamento a quem o tem parado.",
  icons: {
    icon: '/svg/beeznoo-simbolo.svg'
  }
};

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