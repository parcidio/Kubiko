import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt"
      className={`${bricolage.variable} ${dmSans.variable} scroll-smooth`}
    >
      <body>
        {/* pt-[65px] compensa a navbar fixa */}
        <main className="pt-16.25">
          {children}
        </main>
      </body>
    </html>
  );
}