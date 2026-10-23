import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-areia font-sans text-texto-corpo">
      <header className="mx-auto flex h-16 max-w-md items-center px-4">
        <Link href="/" aria-label="Beeznoo — início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/svg/beeznoo-lockup-horizontal-tinta.svg" alt="Beeznoo" className="h-7 w-auto" />
        </Link>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4 pb-12">{children}</main>
    </div>
  );
}
