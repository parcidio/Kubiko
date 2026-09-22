"use client";

import { motion } from "framer-motion";

const ease = [0.25, 0.1, 0.25, 1] as const;

const tableRows = [
  { label: "Custo inicial", buy: "Alto",          kubiko: "Só o dia de uso"  },
  { label: "Manutenção",    buy: "Por tua conta", kubiko: "Não aplicável"    },
  { label: "Proteção",      buy: "—",             kubiko: "Caução incluída"  },
  { label: "Variedade",     buy: "1 equipamento", kubiko: "Catálogo todo"    },
];

const featured = [
  {
    name:   "Canon EOS R6",
    price:  "15.000 Kz/dia",
    rating: 4.8,
    image:  "https://images.unsplash.com/photo-1516724562728-afc824a36e84?w=400&auto=format&fit=crop",
  },
  {
    name:   "Coluna JBL PartyBox",
    price:  "8.000 Kz/dia",
    rating: 4.6,
    image:  "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&auto=format&fit=crop",
  },
  {
    name:   "DJI Mavic 3",
    price:  "20.000 Kz/dia",
    rating: 4.9,
    image:  "https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=400&auto=format&fit=crop",
  },
];

export default function BeeznoHighlights() {
  return (
    <motion.section id="compare" className="bg-background px-6 py-16 sm:px-8 sm:py-20" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Comprar vs Alugar ── */}
          <motion.div className="flex flex-col rounded-2xl border border-border-bg bg-card p-6 sm:p-8" whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Comprar vs<br />Alugar
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Faz sentido alugar quando o uso é pontual.
            </p>

            <div className="mt-8 flex-1">
              <div className="grid grid-cols-3 border-b border-border-bg pb-3">
                <div />
                <p className="text-center text-sm font-medium text-muted-foreground">Comprar</p>
                <p className="text-center text-sm font-semibold text-foreground">Kubiko</p>
              </div>

              {tableRows.map(({ label, buy, kubiko }, i) => (
                <div
                  key={label}
                  className={`grid grid-cols-3 items-center py-4 ${
                    i < tableRows.length - 1 ? "border-b border-border-bg" : ""
                  }`}
                >
                  <span className="text-sm text-foreground">{label}</span>
                  <span className="text-center text-sm text-muted-foreground">{buy}</span>
                  <span className="text-center text-sm font-semibold text-shield">{kubiko}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Em destaque ── */}
          <motion.div className="flex flex-col rounded-2xl border border-border-bg bg-card p-6 sm:p-8" whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Em destaque
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Alguns dos equipamentos disponíveis em Luanda
            </p>

            <motion.div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {featured.map(({ name, price, rating, image }) => (
                <motion.div
                  key={name}
                  className="cursor-pointer overflow-hidden rounded-xl border border-border-bg"
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Imagem */}
                  <div className="relative h-28 sm:h-32 overflow-hidden bg-sand">
                    <motion.img
                      src={image}
                      alt={name}
                      className="h-full w-full object-cover"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3, ease }}
                    />
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-bold leading-tight text-foreground">{name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{price}</p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-xs text-warning">★</span>
                      <span className="text-xs font-semibold text-foreground">{rating}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

        </div>
      </div>
    </motion.section>
  );
}