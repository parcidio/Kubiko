import type { Booking, BookingStatus, Payment } from "./types";
import type { Tone } from "@/components/bz/ui";

export type Perspective = "renter" | "owner";

export const BOOKING_LABEL: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING_OWNER: { label: "À espera do dono", tone: "pendente" },
  ACCEPTED: { label: "Aceite · paga na entrega", tone: "pendente" },
  ACTIVE: { label: "Pago · por entregar", tone: "ok" },
  IN_PROGRESS: { label: "Entregue · em uso", tone: "ok" },
  RETURNED: { label: "Devolvido · caução por devolver", tone: "pendente" },
  COMPLETED: { label: "Concluída", tone: "neutro" },
  CANCELLED_RENTER: { label: "Cancelada", tone: "neutro" },
  CANCELLED_OWNER: { label: "Recusada", tone: "erro" },
  EXPIRED: { label: "Sem resposta", tone: "neutro" },
  DISPUTED: { label: "Problema em análise", tone: "erro" },
};

export const OPEN_STATUSES: BookingStatus[] = ["PENDING_OWNER", "ACCEPTED", "ACTIVE", "IN_PROGRESS", "RETURNED", "DISPUTED"];

/** Já pago: há contrato aceite, comprovativo e checklists. */
export const PAID_STATUSES: BookingStatus[] = ["ACTIVE", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED"];

export const TIMELINE_STEPS = [
  "Pedido enviado",
  "Aceite pelo dono",
  "Pago ao dono",
  "Equipamento entregue",
  "Devolvido",
  "Caução devolvida",
];

/** Quantos passos da timeline estão feitos. */
export function stepsDone(status: BookingStatus) {
  switch (status) {
    case "PENDING_OWNER":
    case "CANCELLED_RENTER":
    case "CANCELLED_OWNER":
    case "EXPIRED":
      return 1;
    case "ACCEPTED":
      return 2;
    case "ACTIVE":
    case "DISPUTED":
      return 3;
    case "IN_PROGRESS":
      return 4;
    case "RETURNED":
      return 5;
    case "COMPLETED":
      return 6;
  }
}

/** "BZ-3F9A1C" — código curto para falar da reserva no WhatsApp e no ATM. */
export function bookingCode(id: string) {
  return `BZ-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

const DAY = 86_400_000;

/**
 * Prazo do passo atual. Pedido: o mesmo que a API aplica (gap #11) — 24 h desde o pedido ou o fim do dia de
 * levantamento, o que vier primeiro. Depois disso o pedido passa a EXPIRED.
 */
export function deadlineOf(b: Booking, payment?: Payment | null): Date | null {
  if (b.status === "PENDING_OWNER") {
    const in24h = new Date(new Date(b.createdAt).getTime() + DAY);
    const [y, m, d] = b.startDate.slice(0, 10).split("-").map(Number);
    const endOfPickupDay = new Date(y, m - 1, d, 23, 59);
    return in24h < endOfPickupDay ? in24h : endOfPickupDay;
  }
  // Pagamento direto: paga-se no levantamento
  if (b.status === "ACCEPTED") {
    if (payment?.status === "AWAITING_PAYMENT") return new Date(payment.expiresAt);
    return endOfDay(b.startDate);
  }
  if (b.status === "ACTIVE") return endOfDay(b.startDate);
  if (b.status === "IN_PROGRESS") return endOfDay(b.endDate);
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
    // Pagamento direto ao dono, na entrega (decisoes-produto.md 2026-11-15)
    case "ACCEPTED":
      return as === "renter"
        ? { who: "you", title: "Aceita o contrato e paga na entrega", text: `Combina o levantamento com ${firstName(b.ownerName)}. Confere o equipamento e só depois pagas ao dono.`, cta: { label: "Como pagar", href: `/reservas/${id}/pagar` } }
        : { who: "you", title: "Recebe o pagamento na entrega", text: `${firstName(b.renterName)} paga-te quando levantar o equipamento. Depois confirma aqui que recebeste.`, cta: { label: "Confirmar pagamento", href: `/reservas/${id}/pagar` } };
    case "ACTIVE":
      return {
        who: "you",
        title: as === "renter" ? "Recebe e fotografa o equipamento" : "Entrega e fotografa o equipamento",
        text: "Na entrega, um de vocês regista o estado com fotos e o outro confirma. Protege as duas partes.",
        cta: { label: "Abrir checklist de entrega", href: `/reservas/${id}/checklist` },
      };
    case "IN_PROGRESS":
      return {
        who: "you",
        title: as === "renter" ? "Devolve na data combinada" : "Recebe o equipamento de volta",
        text: "Na devolução, registem outra vez o estado com fotos. A caução só é decidida depois disto.",
        cta: { label: "Abrir checklist de devolução", href: `/reservas/${id}/checklist` },
      };
    case "RETURNED":
      return as === "renter"
        ? { who: "other", title: `${firstName(b.ownerName)} devolve a caução`, text: "A devolução foi confirmada. O dono devolve-te a caução e regista-o na app. Se houver dano, pode reter parte, com motivo." }
        : { who: "you", title: "Devolve a caução", text: `Devolve a caução a ${firstName(b.renterName)} e regista-o. Se houver dano, podes reter parte, com motivo.`, cta: { label: "Registar caução", href: `/reservas/${id}/caucao` } };
    case "DISPUTED":
      return { who: "team", title: "Problema em análise", text: "A equipa Beeznoo está a analisar. Falamos contigo por WhatsApp." };
    case "COMPLETED":
      return as === "renter"
        ? { who: "done", title: "Aluguer concluído", text: "Conta-nos como correu. Se não recebeste a caução, reporta um problema até 7 dias depois.", cta: { label: "Avaliar", href: `/reservas/${id}/avaliar` } }
        : { who: "done", title: "Aluguer concluído", text: "Recebeste o pagamento na entrega. A taxa de serviço a entregar à Beeznoo está na Carteira.", cta: { label: "Ver carteira", href: "/carteira" } };
    case "CANCELLED_OWNER":
      return as === "renter"
        ? { who: "done", title: "O dono recusou", text: "Não pagaste nada. Há outro equipamento parecido à tua espera.", cta: { label: "Explorar", href: "/explorar" } }
        : { who: "done", title: "Recusaste este pedido", text: "As datas ficaram livres." };
    case "CANCELLED_RENTER":
      return { who: "done", title: "Pedido cancelado", text: "Não houve qualquer pagamento." };
    // Pedido sem resposta a tempo, ou reserva aceite que terminou sem pagamento confirmado (2026-11-15)
    case "EXPIRED":
      return as === "renter"
        ? { who: "done", title: "Reserva expirada", text: "Passou o prazo sem resposta do dono ou sem pagamento confirmado. Se pagaste ao dono, fala connosco.", cta: { label: "Explorar", href: "/explorar" } }
        : { who: "done", title: "Expirada", text: "Passou o prazo sem resposta ou sem pagamento confirmado, e as datas ficaram livres. Se recebeste o pagamento, fala connosco." };
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
