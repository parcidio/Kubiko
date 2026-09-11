"use client";

import { cn } from "@/lib/utils";
import { Search, ShieldCheck, Banknote, FileCheck2 } from "lucide-react";
import type React from "react";

interface StepCardProps {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}

const StepCard: React.FC<StepCardProps> = ({ icon, step, title, description }) => (
  <div
    className={cn(
      "relative rounded-2xl border border-border-bg/10 bg-primary cursor-pointer p-6 text-primary-foreground",
      "transition-all duration-300 ease-in-out",
      "hover:scale-[1.03] hover:shadow-xl hover:border-white/20 hover:bg-white/10"
    )}
  >
    {/* Icon */}
    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-primary-foreground">
      {icon}
    </div>
    {/* Step number */}
    <p className="mb-2 text-sm font-medium text-primary-foreground/40">{step}</p>
    {/* Title */}
    <h3 className="mb-3 text-lg font-bold leading-snug">{title}</h3>
    {/* Description */}
    <p className="text-sm leading-relaxed text-primary-foreground/60">{description}</p>
  </div>
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
    <section className="overflow-hidden bg-primary px-6 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-primary-foreground sm:text-5xl">
            Como funciona
          </h1>
          <p className="mt-4 text-base text-primary-foreground/50">
            Quatro passos para transformar equipamento parado em rendimento
          </p>
        </div>

        {/* Step indicators com linha de ligação — apenas desktop */}
        <div className="relative mx-auto mb-8 hidden lg:block">
          <div
            aria-hidden="true"
            className="absolute left-[12.5%] top-1/2 h-px w-3/4 -translate-y-1/2 bg-white/10"
          />
          <div className="relative grid grid-cols-4">
            {steps.map(({ step }) => (
              <div
                key={step}
                className="flex h-8 w-8 items-center justify-center justify-self-center rounded-full bg-white/10 text-xs font-semibold text-primary-foreground ring-4 ring-primary"
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, title, icon, description }) => (
            <StepCard
              key={step}
              step={step}
              title={title}
              icon={icon}
              description={description}
            />
          ))}
        </div>

      </div>
    </section>
  );
}