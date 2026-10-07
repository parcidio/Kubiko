"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Banknote, FileCheck2 } from "lucide-react";
import type React from "react";

const ease = [0.25, 0.1, 0.25, 1] as const;

interface StepCardProps {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}

const StepCard: React.FC<StepCardProps> = ({ step, icon, title, description }) => (
  <motion.div
    className={cn(
      "relative rounded-2xl bg-background cursor-pointer p-6 text-primary-foreground",
      "transition-all duration-300 ease-in-out",
      "hover:shadow-xl hover:border-white/20 hover:bg-background/90"
    )}
    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
    whileHover={{ scale: 1.03 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
  >
    {/* Icon */}
    <div className="flex gap-12 items-center justify-between">
      <div className="mb-5 mt-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {icon}
      </div>
      {/* Step number */}
      <span className="mb-5 mt-8 absolute right-4 font-display text-5xl font-extrabold text-chart-4">
        {step}
      </span>
    </div>
    {/* Title */}
    <h3 className="mb-3 text-lg font-bold leading-snug text-primary">{title}</h3>
    {/* Description */}
    <p className="text-sm leading-relaxed text-primary">{description}</p>
  </motion.div>
);

export default function BeeznoHowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Encontre e peça",
      icon: <Search className="h-5 w-5" />,
      description:
        "Escolha o item, as datas e envie o pedido ao proprietário verificado.",
    },
    {
      step: "02",
      title: "Cotação de seguro automática",
      icon: <ShieldCheck className="h-5 w-5" />,
      description:
        "Calculamos o prémio pelo valor declarado do item e pela duração do contrato.",
    },
    {
      step: "03",
      title: "Pague por Multicaixa Express",
      icon: <Banknote className="h-5 w-5" />,
      description:
        "Aluguer, caução e prémio num só pagamento, validado pelo ID da transacção.",
    },
    {
      step: "04",
      title: "Apólice activa até à devolução",
      icon: <FileCheck2 className="h-5 w-5" />,
      description:
        "Certificado emitido na hora e participação de sinistro em qualquer momento.",
    },
  ];

  return (
    <motion.section id="howworks" className="overflow-hidden bg-card px-6 py-16 sm:px-8 sm:py-20" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <p className="uppercase tracking-widest text-xs font-sans font-bold text-shield">
            Como funciona
          </p>
          <h1 className="text-4xl font-semibold text-card-foreground sm:text-5xl">
            Alugar em quatro passos
          </h1>
        </div>


        {/* Cards */}
        <motion.div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {steps.map(({ step, title, icon, description }) => (
            <StepCard
              key={step}
              step={step}
              title={title}
              icon={icon}
              description={description}
            />
          ))}
        </motion.div>

      </div>
    </motion.section>
  );
}