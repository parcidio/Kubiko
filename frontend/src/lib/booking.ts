import type { Booking, BookingStatus, Payment } from "./types";
import type { Tone } from "@/components/bz/ui";

export type Perspective = "renter" | "owner";

export const BOOKING_LABEL: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING_OWNER: { label: "À espera do dono", tone: "pendente" },
  ACCEPTED: { label: "Aceite · por pagar", tone: "pendente" },
  ACTIVE: { label: "Pago · em curso", tone: "ok" },
  COMPLETED: { label: "Concluída", tone: "neutro" },
  CANCELLED_RENTER: { label: "Cancelada", tone: "neutro" },
  CANCELLED_OWNER: { label: "Recusada", tone: "erro" },
  DISPUTED: { label: "Problema em análise", tone: "erro" },
};

export const OPEN_STATUSES: BookingStatus[] = ["PENDING_OWNER", "ACCEPTED", "ACTIVE", "DISPUTED"];

export const TIMELINE_STEPS = [
  "Pedido enviado",
  "Aceite pelo dono",
  "Pagamento confirmado",
  "Equipamento entregue",
  "Devolvido",
  "Caução libertada",
];

/** Quantos passos da timeline estão feitos. */
export function stepsDone(status: BookingStatus) {
  switch (status) {
    case "PENDING_OWNER":
    case "CANCELLED_RENTER":
    case "CANCELLED_OWNER":
      return 1;
    case "ACCEPTED":
      return 2;
    case "ACTIVE":
    case "DISPUTED":
      return 3;
    case "COMPLETED":
      return 6;
  }
}

/** "BZ-3F9A1C" — código curto para falar da reserva no WhatsApp e no ATM. */
export function bookingCode(id: string) {
  return `BZ-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

const DAY = 86_400_000;

/** Prazo do passo atual. O backend ainda não expira pedidos (ver BACKEND_GAPS): calculamos as 24 h no frontend. */
export function deadlineOf(b: Booking, payment?: Payment | null): Date | null {
  if (b.status === "PENDING_OWNER") return new Date(new Date(b.createdAt).getTime() + DAY);
  if (b.status === "ACCEPTED") {
    if (payment?.status === "AWAITING_PAYMENT") return new Date(payment.expiresAt);
    return new Date(new Date(b.updatedAt).getTime() + DAY);
  }
  if (b.status === "ACTIVE") return endOfDay(b.endDate);
  return null;
}

function endOfDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 18, 0);
}

export interface NextStep {
  /** "you" = ação tua (botão âmbar) · "other" = à espera da outra parte · "team" = equipa Beeznoo · "done" */
  who: "you" | "other" | "team" | "done";
  title: string;
  text: string;
  cta?: { label: string; href: string };
}

export function nextStep(b: Booking, as: Perspective): NextStep {
  const id = b.id;
  switch (b.status) {
    case "PENDING_OWNER":
      return as === "owner"
        ? { who: "you", title: "Responde ao pedido", text: `${b.renterName} quer alugar. Se não responderes a tempo, o pedido expira.` }
        : { who: "other", title: `À espera de ${firstName(b.ownerName)}`, text: "O dono tem 24 h para responder. Ainda não pagas nada." };
    case "ACCEPTED":
      return as === "renter"
        ? { who: "you", title: "Paga para confirmar", text: "O dono aceitou. Paga por referência Multicaixa para garantir as datas.", cta: { label: "Pagar agora", href: `/reservas/${id}/pagar` } }
        : { who: "other", title: "À espera do pagamento", text: `Aceitaste. Avisamos-te quando ${firstName(b.renterName)} pagar.` };
    case "ACTIVE":
      return {
        who: "you",
        title: as === "renter" ? "Recebe e fotografa o equipamento" : "Entrega e fotografa o equipamento",
        text: "Na entrega, façam juntos a checklist com fotos. Protege as duas partes.",
        cta: { label: "Abrir checklist", href: `/reservas/${id}/checklist` },
      };
    case "DISPUTED":
      return { who: "team", title: "Problema em análise", text: "A equipa Beeznoo está a analisar. Falamos contigo por WhatsApp." };
    case "COMPLETED":
      return as === "renter"
        ? { who: "done", title: "Aluguer concluído", text: "A caução foi libertada. Conta-nos como correu.", cta: { label: "Avaliar", href: `/reservas/${id}/avaliar` } }
        : { who: "done", title: "Aluguer concluído", text: "O valor do aluguer está na tua carteira.", cta: { label: "Ver carteira", href: "/carteira" } };
    case "CANCELLED_OWNER":
      return as === "renter"
        ? { who: "done", title: "O dono recusou", text: "Não pagaste nada. Há outro equipamento parecido à tua espera.", cta: { label: "Explorar", href: "/explorar" } }
        : { who: "done", title: "Recusaste este pedido", text: "As datas ficaram livres." };
    case "CANCELLED_RENTER":
      return { who: "done", title: "Pedido cancelado", text: "Não houve qualquer pagamento." };
  }
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] || "o dono";
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "B";
}

/** Link WhatsApp para a equipa Beeznoo com mensagem pré-preenchida (modelo concierge). */
export function whatsappLink(text: string) {
  // Número público da equipa (+244 939 351 150); NEXT_PUBLIC_WHATSAPP_NUMBER permite trocá-lo sem mexer no código
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "244939351150").replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
