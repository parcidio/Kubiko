import type { Booking, BookingStatus, Payment } from "./types";
import type { Tone } from "@/components/bz/ui";
import { fmt, type Dict } from "./i18n";
import { pt } from "./i18n/pt";

export type Perspective = "renter" | "owner";

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  PENDING_OWNER: "pendente",
  ACCEPTED: "pendente",
  ACTIVE: "ok",
  IN_PROGRESS: "ok",
  RETURNED: "pendente",
  COMPLETED: "neutro",
  CANCELLED_RENTER: "neutro",
  CANCELLED_OWNER: "erro",
  EXPIRED: "neutro",
  DISPUTED: "erro",
};

/** Rótulo + tom do estado na língua do dicionário: bookingLabel(status, useT()). */
export function bookingLabel(status: BookingStatus, t: Dict = pt) {
  return { label: t.bookingStatus[status], tone: BOOKING_TONE[status] };
}

/** Em português (admin). Nos ecrãs traduzidos usa bookingLabel(status, t). */
export const BOOKING_LABEL = Object.fromEntries(
  (Object.keys(BOOKING_TONE) as BookingStatus[]).map((s) => [s, bookingLabel(s)]),
) as Record<BookingStatus, { label: string; tone: Tone }>;

export const OPEN_STATUSES: BookingStatus[] = ["PENDING_OWNER", "ACCEPTED", "ACTIVE", "IN_PROGRESS", "RETURNED", "DISPUTED"];

/** Já pago: há contrato aceite, comprovativo e checklists. */
export const PAID_STATUSES: BookingStatus[] = ["ACTIVE", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED"];

/** Rótulos em português; nos ecrãs usa t.booking.timeline. */
export const TIMELINE_STEPS = pt.booking.timeline;

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

export function nextStep(b: Booking, as: Perspective, t: Dict = pt): NextStep {
  const id = b.id;
  const n = t.booking.next;
  const owner = firstName(b.ownerName, t);
  const renter = firstName(b.renterName, t);
  switch (b.status) {
    case "PENDING_OWNER":
      return as === "owner"
        ? { who: "you", title: n.ownerRespond.title, text: fmt(n.ownerRespond.text, { renter: b.renterName }) }
        : { who: "other", title: fmt(n.renterWaiting.title, { owner }), text: n.renterWaiting.text };
    // Pagamento direto ao dono, na entrega (decisoes-produto.md 2026-11-15)
    case "ACCEPTED":
      return as === "renter"
        ? { who: "you", title: n.renterAccepted.title, text: fmt(n.renterAccepted.text, { owner }), cta: { label: n.renterAccepted.cta, href: `/reservas/${id}/pagar` } }
        : { who: "you", title: n.ownerAccepted.title, text: fmt(n.ownerAccepted.text, { renter }), cta: { label: n.ownerAccepted.cta, href: `/reservas/${id}/pagar` } };
    case "ACTIVE":
      return {
        who: "you",
        title: as === "renter" ? n.activeRenter : n.activeOwner,
        text: n.activeText,
        cta: { label: n.activeCta, href: `/reservas/${id}/checklist` },
      };
    case "IN_PROGRESS":
      return {
        who: "you",
        title: as === "renter" ? n.inProgressRenter : n.inProgressOwner,
        text: n.inProgressText,
        cta: { label: n.inProgressCta, href: `/reservas/${id}/checklist` },
      };
    case "RETURNED":
      return as === "renter"
        ? { who: "other", title: fmt(n.returnedRenter.title, { owner }), text: n.returnedRenter.text }
        : { who: "you", title: n.returnedOwner.title, text: fmt(n.returnedOwner.text, { renter }), cta: { label: n.returnedOwner.cta, href: `/reservas/${id}/caucao` } };
    case "DISPUTED":
      return { who: "team", ...n.disputed };
    case "COMPLETED":
      return as === "renter"
        ? { who: "done", title: n.completedTitle, text: n.completedRenter.text, cta: { label: n.completedRenter.cta, href: `/reservas/${id}/avaliar` } }
        : { who: "done", title: n.completedTitle, text: n.completedOwner.text, cta: { label: n.completedOwner.cta, href: "/carteira" } };
    case "CANCELLED_OWNER":
      return as === "renter"
        ? { who: "done", title: n.declinedRenter.title, text: n.declinedRenter.text, cta: { label: n.declinedRenter.cta, href: "/explorar" } }
        : { who: "done", ...n.declinedOwner };
    case "CANCELLED_RENTER":
      return { who: "done", ...n.cancelled };
    // Pedido sem resposta a tempo, ou reserva aceite que terminou sem pagamento confirmado (2026-11-15)
    case "EXPIRED":
      return as === "renter"
        ? { who: "done", title: n.expiredRenter.title, text: n.expiredRenter.text, cta: { label: n.expiredRenter.cta, href: "/explorar" } }
        : { who: "done", ...n.expiredOwner };
  }
}

export function firstName(name: string | null | undefined, t: Dict = pt) {
  return (name ?? "").trim().split(/\s+/)[0] || t.booking.theOwner;
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
