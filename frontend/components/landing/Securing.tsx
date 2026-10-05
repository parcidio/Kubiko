"use client";
import { motion } from "framer-motion";
import { ShieldCheck, BadgeCheck, Truck, Search, Banknote, FileCheck2 } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

function abrirWhatsapp(): void {
  const NUMERO = "244932300335";
  const texto  = encodeURIComponent("Olá! Sou um cliente e tenho interesse em saber sobre a Beeznoo.");
  fetch(`/api/track-click`).catch(() => {});
  window.open(`https://wa.me/${NUMERO}?text=${texto}`, "_blank");
}

export default function BeeznoSecuring() {
  const cards = [
    {
      title: "Perfis verificados",
      icon: <Search className="h-5 w-5" />,
      description:
        "Todos os utilizadores confirmam a identidade antes de alugar ou disponibilizar.",
    },
    {
      title: "Pagamentos pela plataforma",
      icon: <ShieldCheck className="h-5 w-5" />,
      description:
        "Pagas e recebes dentro do Beeznoo, com registo de cada transação.",
    },
    {
      title: "Caução protegida",
      icon: <Banknote className="h-5 w-5" />,
      description:
        "A caução fica guardada durante o aluguer e é devolvida quando o equipamento é devolvido em bom estado.",
    },
    {
      title: "Contrato em cada reserva",
      icon: <FileCheck2 className="h-5 w-5" />,
      description:
        "Datas, preço, caução e condições ficam por escrito. Para os dois lados.",
    },
  ];
  return (
    <motion.section className="bg-accent px-6 py-16 sm:px-8 sm:py-20" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
      <div className="mx-auto max-w-6xl space-y-6">

        <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-3" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>

          {/* Card 1: checklist */}
            {
              cards.map((card, index) => (
                <motion.div key={index} className="rounded-2xl bg-card sm:p-8 mb-6 last:mb-0 items-start gap-4" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/40 text-primary">
                    {card.icon}
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{card.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {card.description}
                  </p>
              </motion.div>
              ))
            }
        </motion.div>

      </div>
    </motion.section>
  );
}