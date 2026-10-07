"use client";

import { motion } from "framer-motion";

const ease = [0.25, 0.1, 0.25, 1] as const;

function CardHex({ stroke, width, height, strokeWidth }: { stroke: string, width?: number, height?: number, strokeWidth?: number }) {
  return (
    <svg
      className="absolute -bottom-10 -right-10  opacity-20"
      width={width || 180}
      height={height || 180}
      viewBox="0 0 180 180"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M90 8 L165 50 L165 130 L90 172 L15 130 L15 50 Z"
        stroke={stroke}
        strokeWidth={strokeWidth || 4}
      />
    </svg>
  );
}

export default function BeeznoHighlights() {
  return (
    <motion.section
      id="highlights"
      className="bg-background px-6 py-16 sm:px-8 sm:py-20"
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.7, ease }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Para quem precisa ── */}
          <motion.div
            className="relative flex flex-col overflow-hidden rounded-2xl bg-warning p-8 sm:p-10"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div>
              <CardHex stroke="#0E3B2C" width={176} height={176} />
              <CardHex stroke="#0E3B2C" width={150} height={150} />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Para quem precisa
            </p>

            <h2 className="mt-4 text-[2rem] font-black leading-tight text-primary sm:text-[2.4rem]">
              Usa só quando precisas.
              <br />
              Paga só quando usas.
            </h2>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary/70 sm:text-base">
              Uma obra em casa, um evento no fim de semana, um trabalho pontual — não
              precisas de comprar equipamento que vai ficar parado.
            </p>

            <div className="mt-8">
              <a
                href="https://tally.so/r/dW7yGK"
                target="_blank"
                className="inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/85 hover:shadow-lg"
              >
                Quero alugar
              </a>
            </div>
          </motion.div>

          {/* ── Para quem tem equipamento ── */}
          <motion.div
            className="relative flex flex-col overflow-hidden rounded-2xl bg-primary p-8 sm:p-10"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div>
              <CardHex stroke="#FFC72C" width={176} height={176}/>
              <CardHex stroke="#FFC72C" width={150} height={150}/>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-warning">
              Para quem tem equipamento
            </p>

            <h2 className="mt-4 text-[2rem] font-black leading-tight text-shield-foreground sm:text-[2.4rem]">
              Equipamento parado?
              <br />
              Põe-no a render.
            </h2>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-shield-foreground/70 sm:text-base">
              Particular ou empresa, disponibiliza o que tens, define o preço e as
              datas, e recebe por cada aluguer — com caução e contrato em cada reserva.
            </p>

            <div className="mt-8">
              <a
                href="https://tally.so/r/5BN0JZ"
                target="_blank"
                className="inline-block rounded-full bg-warning px-6 py-3 text-sm font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-warning/90 hover:shadow-lg"
              >
                Quero disponibilizar
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.section>
  );
}