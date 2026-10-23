import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
      lang="pt"
      className={`${bricolage.variable} ${spaceGrotesk.variable} ${dmSans.variable} scroll-smooth`}
    >
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}