"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Calendar, Clock, Timer, Zap } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

// ── Altera esta linha para mudar a data de lançamento ──
const LAUNCH_DATE = new Date("2026-10-18T00:00:00");
// ───────────────────────────────────────────────────────

const NUMERO = "244932300335";

const PROVINCIAS = [
  "Luanda", "Benguela", "Huambo", "Bié", "Cabinda",
  "Cuando Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene",
  "Huíla", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico",
  "Namibe", "Uíge", "Zaire", "Bengo",
];

const BENEFICIOS = [
  "Acesso antecipado à plataforma",
  "Aviso assim que abrirmos na tua província",
  "Benefícios exclusivos para os primeiros inscritos",
];

const countdownUnits = [
  { icon: Calendar, label: "dias",   key: "days"    as const },
  { icon: Clock,    label: "horas",  key: "hours"   as const },
  { icon: Timer,    label: "min",    key: "minutes" as const },
  { icon: Zap,      label: "seg",    key: "seconds" as const },
];

type Objetivo = "alugar" | "disponibilizar" | "ambos";
type Perfil   = "particular" | "empresa";

// ── Countdown ──────────────────────────────────────────
function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(target));
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  return timeLeft;
}

// ── Decoração hexagonal ────────────────────────────────
function HexDecor({ size, style, opacity = 0.07 }: {
  size: number;
  style: React.CSSProperties;
  opacity?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 220 220"
      style={{ position: "absolute", pointerEvents: "none", ...style }}
      fill="none" stroke="currentColor" strokeWidth="1"
      opacity={opacity} aria-hidden="true"
    >
      <path d="M55 10 L88 29 L88 67 L55 86 L22 67 L22 29 Z" />
      <path d="M121 10 L154 29 L154 67 L121 86 L88 67 L88 29 Z" />
      <path d="M187 10 L220 29 L220 67 L187 86 L154 67 L154 29 Z" />
      <path d="M88 67 L121 86 L121 124 L88 143 L55 124 L55 86 Z" />
      <path d="M154 67 L187 86 L187 124 L154 143 L121 124 L121 86 Z" />
      <path d="M55 124 L88 143 L88 181 L55 200 L22 181 L22 143 Z" />
      <path d="M121 124 L154 143 L154 181 L121 200 L88 181 L88 143 Z" />
      <path d="M187 124 L220 143 L220 181 L187 200 L154 181 L154 143 Z" />
    </svg>
  );
}

// ── Componente principal ───────────────────────────────
export default function BeeznoHero() {
  const timeLeft = useCountdown(LAUNCH_DATE);

  const [objetivo,  setObjetivo]  = useState<Objetivo>("alugar");
  const [nome,      setNome]      = useState("");
  const [email,     setEmail]     = useState("");
  const [telefone,  setTelefone]  = useState("");
  const [provincia, setProvincia] = useState("Luanda");
  const [perfil,    setPerfil]    = useState<Perfil>("particular");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const objetivoTexto = {
      alugar:         "alugar equipamento",
      disponibilizar: "disponibilizar equipamento",
      ambos:          "alugar e disponibilizar equipamento",
    }[objetivo];

    const msg =
      `Olá! Quero entrar na lista de espera do Beeznoo.\n\n` +
      `Nome: ${nome}\n` +
      `Email: ${email}\n` +
      `Telefone/WhatsApp: ${telefone}\n` +
      `Província: ${provincia}\n` +
      `Perfil: ${perfil === "particular" ? "Particular" : "Empresa"}\n` +
      `Objetivo: ${objetivoTexto}`;

    fetch(`/api/track-click?tipo=${objetivo}`).catch(() => {});
    window.open(`https://wa.me/${NUMERO}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <motion.section
      id="explore"
      className="relative min-h-screen overflow-hidden bg-primary"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Decorações hexagonais */}
      <HexDecor
        size={580}
        style={{ right: -160, top: -180, color: "var(--color-primary-foreground)" }}
        opacity={0.06}
      />
      <HexDecor
        size={260}
        style={{ left: -70, bottom: 80, color: "var(--color-primary-foreground)" }}
        opacity={0.04}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-24">

        {/* ── Coluna esquerda ── */}
        <motion.div
          className="flex flex-col gap-6"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          {/* Badge */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-foreground/20 font-black px-4 py-1.5 text-xs text-primary-foreground/80">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
            Em breve em Angola · Lista de espera aberta
          </div>

          {/* Headline */}
          <h1 className="text-[3.5rem] font-black leading-[1.06] text-background sm:text-5xl lg:text-[4.0rem]">
            Precisas de
            <br />
            equipamento?
            <br />
            <span className="text-warning font-black">Aluga, não compres.</span>
          </h1>

          {/* Descrição */}
          <p className="max-w-md text-[15px] leading-relaxed font-light text-accent lg:text-base">
            O Beeznoo liga quem precisa de equipamento a quem o tem parado —
            particulares e empresas, em Angola. Entra na lista e sê dos primeiros.
          </p>

          {/* Benefícios */}
          <ul className="space-y-3">
            {BENEFICIOS.map(b => (
              <li key={b} className="flex items-center font-bold gap-3 text-sm text-background">
                <Check className="h-4 w-4 shrink-0 text-warning" />
                {b}
              </li>
            ))}
          </ul>

          {/* Countdown */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-accent">
              Próxima release em
            </p>
            <div className="flex gap-4">
              {countdownUnits.map(({ label, key }) => (
                <div
                  key={key}
                  className="flex min-w-14.5 flex-col items-center rounded-lg bg-white/10 px-8 py-3 sm:min-w-17 sm:px-4"
                >
                  <span className="num text-2xl font-bold text-warning sm:text-3xl">
                    {String(timeLeft[key]).padStart(2, "0")}
                  </span>
                  <span className="mt-0.5 text-[10px] text-primary-foreground/50">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Coluna direita: formulário ── */}
        <motion.div
          className="rounded-2xl bg-card p-6 shadow-lift sm:p-8"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease }}
        >
          <h2 className="text-xl font-bold text-foreground">Entra na lista de espera</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leva menos de um minuto.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">

            {/* Objetivo */}
            <div>
              <label className="mb-2 block text-xs font-bold text-foreground">
                O que queres fazer?
              </label>
              <div className="flex gap-2">
                {(["alugar", "disponibilizar", "ambos"] as Objetivo[]).map(op => (
                  <button
                    key={op} type="button"
                    onClick={() => setObjetivo(op)}
                    className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-150 ${
                      objetivo === op
                        ? "bg-primary text-primary-foreground"
                        : "border border-border-bg bg-secondary text-foreground hover:border-primary"
                    }`}
                  >
                    {op === "alugar" ? "Quero alugar" : op === "disponibilizar" ? "Quero disponibilizar" : "Ambos"}
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Nome</label>
              <input
                type="text" required value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="O teu nome"
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
              />
            </div>

            {/* Email + Telefone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">Email</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@email.com"
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">Telefone / WhatsApp</label>
                <input
                  type="tel" required value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="+244 9XX XXX XXX"
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
                />
              </div>
            </div>

            {/* Província + Perfil */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">Província</label>
                <select
                  value={provincia}
                  onChange={e => setProvincia(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-shield"
                >
                  {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">Sou</label>
                <div className="flex gap-2">
                  {(["particular", "empresa"] as Perfil[]).map(p => (
                    <button
                      key={p} type="button"
                      onClick={() => setPerfil(p)}
                      className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-150 ${
                        perfil === p
                          ? "bg-primary text-primary-foreground"
                          : "border border-border-bg bg-secondary text-foreground hover:border-primary"
                      }`}
                    >
                      {p === "particular" ? "Particular" : "Empresa"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="group relative w-full overflow-hidden rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground transition-shadow hover:shadow-lift"
            >
              <span className="absolute inset-0 -translate-x-full bg-shield transition-transform duration-300 ease-out group-hover:translate-x-0" />
              <span className="relative flex items-center justify-center gap-2">
                Entrar na lista de espera
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            {/* Privacidade */}
            <p className="text-center text-[11px] text-muted-foreground">
              Sem spam. Só te escrevemos com novidades do lançamento.{" "}
              <a href="/privacidade" className="underline transition-colors hover:text-foreground">
                Política de Privacidade
              </a>
              .
            </p>
          </form>
        </motion.div>
      </div>
    </motion.section>
  );
}