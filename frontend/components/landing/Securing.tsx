"use client";

import { motion } from "framer-motion";
import { Contact, Lock, ShieldCheck, FileText } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const cards = [
  {
    icon: <Contact className="h-5 w-5" />,
    title: "Perfis verificados",
    description: "Todos os utilizadores confirmam a identidade antes de alugar ou disponibilizar.",
  },
  {
    icon: <Lock className="h-5 w-5" />,
    title: "Pagamento pela plataforma",
    description: "Pagas e recebes dentro do Beeznoo, com registo de cada transação.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Caução protegida",
    description: "A caução fica guardada durante o aluguer e é devolvida quando o equipamento volta em bom estado.",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Contrato em cada reserva",
    description: "Datas, preço, caução e condições ficam por escrito — para os dois lados.",
  },
];

export default function BeeznoSecuring() {
  return (
    <motion.section
      id="securing"
      className="bg-shield-soft px-6 py-16 sm:px-8 sm:py-20"
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.7, ease }}
    >
      <div className="mx-auto max-w-6xl">

        {/* Cabeçalho — label + headline à esq, descrição à dir */}
        <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-shield">
              Confiança em primeiro lugar
            </p>
            <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
              Alugar a um desconhecido,
              <br />sem desconfiança.
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground lg:ml-auto lg:max-w-xs lg:text-base">
            Cada aluguer no Beeznoo tem regras claras para os dois lados.
          </p>
        </div>

        {/* Cards — 1 col mobile, 2 tablet, 4 desktop */}
        <motion.div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
        >
          {cards.map(({ icon, title, description }, i) => (
            <motion.div
              key={i}
              className="rounded-2xl bg-card p-6"
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-warning/30 text-primary">
                {icon}
              </div>
              <h3 className="font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}