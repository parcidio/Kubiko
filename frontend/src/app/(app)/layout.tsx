import { AppHeader, BottomNav } from "@/components/beeznoo/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-areia font-sans text-[15px] text-texto-corpo md:text-base">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-40 md:px-12 md:pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
