"use client";

import { motion } from "framer-motion";
import { ShieldCheck, BadgeCheck, Truck } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const checklistItems = [
  "Contrato gerado automaticamente",
  "Caução protegida",
  "Pagamento por Multicaixa Express",
  "Suporte via WhatsApp",
];

const features = [
  {
    icon: BadgeCheck,
    title: "Contrapartes verificadas",
    description:
      "Particulares com BI validado e empresas com NIF e certidão comercial confirmados pela nossa equipa.",
  },
  {
    icon: ShieldCheck,
    title: "Cobertura transparente",
    description:
      "O prémio aparece separado no checkout, com o que está coberto, a franquia e o processo de sinistro.",
  },
  {
    icon: Truck,
    title: "Logística local",
    description:
      "Entrega e recolha combinadas entre as partes, com estado do item registado em fotografia.",
  },
];

export default function BeeznoSecuring() {
  return (
    <motion.section className="bg-background px-6 py-16 sm:px-8 sm:py-20" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Linha 1: três cards distintos ── */}
        <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-3" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>

          {/* Card 1: checklist */}
          <motion.div className="rounded-2xl border border-border-bg bg-card p-6 sm:p-8" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <h2 className="text-xl font-bold text-foreground">Simples e transparente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Do pedido à entrega, sem complicações.
            </p>
            <ul className="mt-6 space-y-0">
              {checklistItems.map((item, i) => (
                <li
                  key={item}
                  className={`flex items-center gap-3 py-3 ${
                    i < checklistItems.length - 1 ? "border-b border-border-bg" : ""
                  }`}
                >
                  <span className="text-sm font-bold text-shield">✓</span>
                  <span className="text-sm text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Card 2: destaque escuro centrado */}
          <motion.div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl bg-primary p-6 text-center sm:p-8" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-shield-soft">
              <ShieldCheck className="h-7 w-7 text-shield" />
            </div>
            <h2 className="text-xl font-bold text-primary-foreground">
              Protegemos a transação
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
              Verificação de identidade e caução em toda reserva.
            </p>
          </motion.div>

          {/* Card 3: waitlist */}
          <motion.div className="rounded-2xl bg-shield-soft p-6 sm:p-8" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <h2 className="text-xl font-bold text-foreground">Entra na lista de espera</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sê dos primeiros a usar a Beeznoo em Luanda.
            </p>
            <div className="mt-6 flex gap-2">
              <input
                type="tel"
                placeholder="O teu WhatsApp"
                className="flex-1 rounded-lg border border-border-bg bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
              />
              <button className="cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                Entrar
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Linha 2: três feature cards ── */}
        <motion.div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {features.map(({ icon: Icon, title, description }) => (
            <motion.div
              key={title}
              className="rounded-2xl border border-border-bg bg-card p-6 sm:p-8"
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-shield-soft">
                <Icon className="h-5 w-5 text-shield" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </motion.section>
  );
}