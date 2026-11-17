/** Escala sequencial verde (claro → escuro) da paleta, para o mapa e a legenda do Admin › Mapa. */
export const HEAT_SCALE = ["#E3F0E9", "#8FC0A8", "#4F8F6E", "#1F5C42", "#0E2A1F"];

export function heatColor(count: number, max: number) {
  if (max <= 0) return HEAT_SCALE[0];
  const i = Math.min(HEAT_SCALE.length - 1, Math.floor((count / max) * HEAT_SCALE.length));
  return HEAT_SCALE[Math.max(0, i)];
}
