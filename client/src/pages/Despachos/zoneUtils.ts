import { Order } from "../../api/client";

/** Zonas conocidas de reparto, en el orden usado para agrupar/ordenar (mockup §4.9). */
export const ZONES = ["Norte", "Sur", "Oeste", "Oriente"];

/**
 * Resuelve la zona de entrega de un pedido:
 * 1) si la dirección de entrega coincide exactamente con una dirección guardada de la persona
 *    destinataria y esa dirección tiene una zona asignada manualmente, se usa esa zona;
 * 2) si no, se intenta adivinar por palabras clave en la dirección;
 * 3) si nada coincide, retorna "" (zona desconocida).
 */
export function orderZone(order: Order): string {
  const deliveryAddress = order.deliveryAddress || "";
  const addresses = order.recipientPersona?.addresses;
  if (addresses && deliveryAddress) {
    const match = addresses.find((a) => a.address === deliveryAddress);
    if (match?.zone) return match.zone;
  }

  const s = deliveryAddress.toLowerCase();
  if (/\bnorte\b/.test(s)) return "Norte";
  if (/\bsur\b/.test(s)) return "Sur";
  if (/\boeste\b|\boccidente\b/.test(s)) return "Oeste";
  if (/\boriente\b|\beste\b/.test(s)) return "Oriente";
  return "";
}

/** Orden de clasificación por zona: ZONES en su orden, luego "" (desconocida) al final. */
export function zoneSortOrder(zone: string): number {
  const idx = ZONES.indexOf(zone);
  return idx === -1 ? ZONES.length : idx;
}
