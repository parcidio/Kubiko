"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/bz/admin";
import { MessageComposer, MessageHistory, TemplatesManager } from "@/components/bz/admin-messages";
import { Segmented } from "@/components/bz/tabs";

type Tab = "nova" | "historico" | "modelos";

/** Admin › Mensagens: compor e enviar (WhatsApp, email, SMS), histórico com estados e modelos. */
export default function MensagensPage() {
  return (
    <Suspense>
      <Mensagens />
    </Suspense>
  );
}

function Mensagens() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = raw === "historico" || raw === "modelos" ? raw : "nova";

  return (
    <div className="grid max-w-6xl gap-5">
      <AdminHeader title="Mensagens" text="Avisa as pessoas certas no momento certo: KYC parado, reserva por aceitar, novidades. Só envio, não é chat." />
      <Segmented<Tab>
        label="Mensagens"
        value={tab}
        onChange={(v) => router.replace(v === "nova" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
        options={[
          { value: "nova", label: "Nova" },
          { value: "historico", label: "Histórico" },
          { value: "modelos", label: "Modelos" },
        ]}
        className="max-w-md"
      />
      {tab === "nova" && <MessageComposer />}
      {tab === "historico" && <MessageHistory />}
      {tab === "modelos" && <TemplatesManager />}
    </div>
  );
}
