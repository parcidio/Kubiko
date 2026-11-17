import { AppLocationPrompt } from "@/components/bz/location";
import { AppShell } from "@/components/bz/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <AppLocationPrompt />
    </AppShell>
  );
}
