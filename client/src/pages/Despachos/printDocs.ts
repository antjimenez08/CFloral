import { Order } from "../../api/client";
import { orderZone } from "./zoneUtils";

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Abre una ventana nueva, escribe el documento y dispara el diálogo de impresión del navegador. */
function openAndPrint(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Habilita las ventanas emergentes para poder imprimir este documento.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

const BASE_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 0; color: #232329; }
  .wordmark { font-weight: 700; letter-spacing: 0.02em; color: #be185d; }
  .muted { color: #6b7280; }
  .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .dashed { border: 1.5px dashed #9ca3af; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #fce7f3; color: #9d174d; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 13px; }
`;

/** Tarjeta de regalo (~6cm x 9cm): para el destinatario, nunca muestra notas internas. */
export function printGiftCard(order: Order) {
  const recipientName = order.recipientName || order.customer.name;
  const message = order.cardMessage?.trim() ? escapeHtml(order.cardMessage) : "¡Con mucho cariño!";
  const storeName = order.store?.name || "compañíafloral";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Tarjeta ${escapeHtml(order.invoiceNumber)}</title>
<style>
  ${BASE_STYLE}
  @page { size: 9cm 6cm; margin: 0; }
  body { width: 9cm; height: 6cm; }
  .card { width: 9cm; height: 6cm; padding: 0.5cm; display: flex; flex-direction: column; justify-content: space-between; }
  .msg { font-style: italic; font-family: Georgia, "Times New Roman", serif; font-size: 14px; line-height: 1.4; text-align: center; margin: 0 4px; }
  .line { font-size: 12px; }
</style>
</head>
<body>
  <div class="card">
    <div class="wordmark" style="font-size:12px;">${escapeHtml(storeName)}</div>
    <div class="msg">${message}</div>
    <div>
      <div class="line">Para: <strong>${escapeHtml(recipientName)}</strong></div>
      <div class="line">De: <strong>${escapeHtml(order.customer.name)}</strong></div>
    </div>
  </div>
</body>
</html>`;

  openAndPrint(html);
}

/** Orden de despacho para el domiciliario/transportador: nunca se muestra al cliente. */
export function printDispatchOrder(order: Order) {
  const storeName = order.store?.name || "compañíafloral";
  const zone = orderZone(order) || "Sin zona";
  const recipientName = order.recipientName || order.customer.name;
  const recipientPhone = order.recipientPersona?.phone || order.customer.phone || "";
  const itemsText = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
  const scheduleParts: string[] = [];
  if (order.deliveryDate) scheduleParts.push(new Date(order.deliveryDate).toLocaleDateString("es-CO"));
  if (order.scheduledShift) scheduleParts.push(order.scheduledShift);
  if (order.scheduledHour) scheduleParts.push(order.scheduledHour);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Orden de despacho ${escapeHtml(order.invoiceNumber)}</title>
<style>
  ${BASE_STYLE}
  @page { size: 5.5in 5in; margin: 0.3in; }
  .header { display:flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  h1 { font-size: 16px; margin: 0; }
  .section { margin-bottom: 10px; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="wordmark" style="font-size:14px;">${escapeHtml(storeName)}</div>
      <h1>Orden de despacho</h1>
    </div>
    <div style="text-align:right;">
      <div class="muted" style="font-size:12px;">${escapeHtml(order.invoiceNumber)}</div>
      <span class="tag">${escapeHtml(zone)}</span>
    </div>
  </div>

  <div class="section box">
    <div class="label">Destinatario</div>
    <div style="font-size:14px; font-weight:600;">${escapeHtml(recipientName)}</div>
    ${recipientPhone ? `<div style="font-size:13px;">Tel: ${escapeHtml(recipientPhone)}</div>` : ""}
    <div style="font-size:13px; margin-top:4px;">${escapeHtml(order.deliveryAddress || "")}</div>
    ${order.deliveryCity ? `<div style="font-size:13px;">${escapeHtml(order.deliveryCity)}</div>` : ""}
  </div>

  ${
    scheduleParts.length
      ? `<div class="section">
    <div class="label">Entrega programada</div>
    <div style="font-size:13px;">${scheduleParts.map(escapeHtml).join(" · ")}</div>
  </div>`
      : ""
  }

  <div class="section">
    <div class="label">Pedido</div>
    <div style="font-size:13px;">${escapeHtml(itemsText)}</div>
  </div>

  ${
    order.notes
      ? `<div class="dashed">
    <div class="label">⚠ Nota interna (no mostrar al cliente)</div>
    <div style="font-size:13px; white-space:pre-wrap;">${escapeHtml(order.notes)}</div>
  </div>`
      : ""
  }
</body>
</html>`;

  openAndPrint(html);
}
