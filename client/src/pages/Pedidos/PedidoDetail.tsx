import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, CompanySettings, Order, OrderStatus, PAY_LABEL, STATUS_LABEL } from "../../api/client";
import { money } from "../../lib/labels";

const statusOptions: OrderStatus[] = ["PENDING", "IN_PROGRESS", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const paymentOptions: Order["paymentStatus"][] = ["UNPAID", "PARTIAL", "PAID"];

function surveyMissing(o: Order): string[] {
  const missing: string[] = [];
  if (!o.rating) missing.push("calificación general");
  if (!o.qCalidad) missing.push("calidad");
  if (!o.qPuntualidad) missing.push("puntualidad");
  if (!o.qRecomendacion) missing.push("recomendación");
  if (!(o.ratingComment ?? "").trim()) missing.push("comentario");
  return missing;
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className={`text-2xl leading-none ${n <= value ? "text-yellow-500" : "text-gray-300"}`} aria-label={`${n} estrellas`}>
          ★
        </button>
      ))}
    </div>
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Comprobante imprimible ("Certificado de pago"): mismo contenido que se muestra en pantalla
// (logo de la sede, forma de pago, ocasión, "Enviar a") en una hoja compacta de media carta.
function printOrder(order: Order, company: CompanySettings | null) {
  const win = window.open("", "_blank");
  if (!win) return;
  const itemsHtml = order.items
    .map((it) => `<tr><td>${esc(it.productName)}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${money(it.unitPrice)}</td><td style="text-align:right">${money(it.subtotal)}</td></tr>`)
    .join("");
  const storeName = order.store?.name ?? "";
  const logo = order.store?.logo;
  const recipientBlock = order.recipientName
    ? `<div class="info-box"><div class="k">Enviar a</div><div class="strong">${esc(order.recipientName)}</div>${order.deliveryAddress ? `<div class="muted">${esc(order.deliveryAddress)}</div>` : ""}</div>`
    : `<div class="info-box"><div class="k">Enviar a</div><div class="muted">Mismo cliente</div></div>`;
  const noteRows = [
    order.paymentMethod ? { label: "Forma de pago", value: order.paymentMethod } : null,
    order.occasion ? { label: "Ocasión", value: order.occasion } : null,
  ].filter((x): x is { label: string; value: string } => !!x);

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.invoiceNumber)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      @page { size: 5.5in 5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font-family: "Poppins", Arial, Helvetica, sans-serif; font-size: 9.5px; color: #232329; background: #EDE9E3; display: flex; justify-content: center; padding: 14px 10px; }
      .sheet { width: 5.5in; background: #fff; border-radius: 10px; box-shadow: 0 18px 40px -18px rgba(35,35,41,.35); padding: 14px 16px 12px; position: relative; overflow: hidden; }
      .accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg,#EE6795,#F5A6C1); }
      .head { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 6px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 2px solid #FCE3EC; }
      .head img { max-height: 32px; max-width: 140px; width: auto; object-fit: contain; display: block; margin-bottom: 3px; }
      .store { font-weight: 800; font-size: 14px; color: #EE6795; letter-spacing: .01em; }
      .muted { color: #8a8791; font-size: 8.5px; line-height: 1.4; }
      .doc-badge { text-align: right; }
      .doc-badge .kind { font-size: 8px; text-transform: uppercase; letter-spacing: .09em; color: #8a8791; font-weight: 600; }
      .doc-badge .num { font-weight: 700; font-size: 11px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
      .info-box .k { font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; color: #8a8791; margin-bottom: 2px; }
      .info-box .strong { font-weight: 700; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; }
      thead th { text-align: left; font-size: 7.5px; text-transform: uppercase; color: #8a8791; padding: 3px 6px; border-bottom: 1px solid #F1EDEA; }
      tbody td { padding: 4px 6px; border-bottom: 1px solid #F1EDEA; }
      tbody tr:nth-child(even) { background: #FBF9F7; }
      .total-box { display: flex; justify-content: flex-end; align-items: center; gap: 8px; background: #232329; color: #fff; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
      .total-box .lbl { font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em; color: #F5C7D8; }
      .total-box .amt { font-size: 15px; font-weight: 800; }
      .notes { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
      .notes .item { font-size: 9px; }
      .notes .item .k { color: #8a8791; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; display: block; margin-bottom: 1px; }
      .card-message { background: #FCE3EC; border-radius: 8px; padding: 6px 10px; font-size: 9px; font-style: italic; color: #5c3c47; margin-bottom: 6px; }
      .card-message .k { display: block; font-style: normal; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; color: #EE6795; font-weight: 700; margin-bottom: 2px; }
      .internal-note { background: #F6E6CE; border-radius: 8px; padding: 6px 10px; font-size: 9px; color: #5c4720; margin-bottom: 6px; }
      .internal-note .k { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; color: #B45309; font-weight: 700; margin-bottom: 2px; }
      .foot { margin-top: 8px; padding-top: 6px; border-top: 1px solid #F1EDEA; font-size: 7px; color: #a6a3ab; text-align: center; }
      .print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; padding: 10px 16px; background: #232329; }
      .print-toolbar button { font-family: "Poppins", Arial, sans-serif; font-weight: 700; font-size: 12.5px; padding: 9px 18px; border-radius: 7px; border: none; background: #EE6795; color: #fff; cursor: pointer; }
      .print-toolbar p { color: #cfcdd2; font-size: 10.5px; margin: 0; }
      @media print { .print-toolbar { display: none !important; } body { background: #fff; padding: 0; } .sheet { box-shadow: none; border-radius: 0; width: auto; } }
    </style></head><body>
    <div class="print-toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button><p>Si el diálogo de impresión no se abrió solo, usa este botón o Ctrl+P.</p></div>
    <div class="sheet">
      <div class="accent-bar"></div>
      <div class="head">
        <div>
          ${logo ? `<img src="${logo}">` : `<div class="store">${esc(company?.razonSocial || storeName || "compañíafloral")}</div>`}
          ${company?.nit ? `<div class="muted">NIT ${esc(company.nit)}</div>` : ""}
          ${company?.address ? `<div class="muted">${esc(company.address)}</div>` : ""}
          <div class="muted">Tienda: ${esc(storeName)}</div>
        </div>
        <div class="doc-badge"><div class="kind">Certificado de pago</div><div class="num">${esc(order.invoiceNumber)}</div><div class="muted">${new Date(order.createdAt).toLocaleDateString("es-CO")}</div></div>
      </div>
      <div class="info-grid">
        <div class="info-box"><div class="k">Cliente</div><div class="strong">${esc(order.customer.name)}</div>${order.customer.phone ? `<div class="muted">${esc(order.customer.phone)}</div>` : ""}</div>
        ${recipientBlock}
      </div>
      <table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total-box"><span class="lbl">Total</span><span class="amt">${money(order.total)}</span></div>
      ${noteRows.length ? `<div class="notes">${noteRows.map((n) => `<div class="item"><span class="k">${esc(n.label)}</span>${esc(n.value)}</div>`).join("")}</div>` : ""}
      ${order.cardMessage ? `<div class="card-message"><span class="k">Mensaje en la tarjeta</span>${esc(order.cardMessage)}</div>` : ""}
      ${order.notes ? `<div class="internal-note"><span class="k">Anotaciones internas</span>${esc(order.notes)}</div>` : ""}
      ${company?.resolution ? `<div class="foot">${esc(company.resolution)}</div>` : ""}
    </div>
    <script>(function(){function go(){try{window.print();}catch(e){}}if(document.readyState==="complete")setTimeout(go,250);else window.addEventListener("load",function(){setTimeout(go,250);});})();</script>
    </body></html>`);
  win.document.close();
}

function orderShareText(order: Order): string {
  const lines = [
    `Pedido ${order.invoiceNumber} — compañíafloral`,
    `Cliente: ${order.customer.name}`,
    order.recipientName ? `Enviar a: ${order.recipientName}` : "",
    ...order.items.map((it) => `${it.quantity}x ${it.productName} — ${money(it.subtotal)}`),
    `Total: ${money(order.total)}`,
    order.paymentMethod ? `Forma de pago: ${order.paymentMethod}` : "",
    "¡Gracias por tu compra!",
  ];
  return lines.filter(Boolean).join("\n");
}

export default function PedidoDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [qCalidad, setQCalidad] = useState(0);
  const [qPuntualidad, setQPuntualidad] = useState(0);
  const [qRecomendacion, setQRecomendacion] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [surveyNotes, setSurveyNotes] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await api.get<Order>(`/orders/${id}`);
    setOrder(res.data);
    setRatingDraft(res.data.rating ?? 0);
    setQCalidad(res.data.qCalidad ?? 0);
    setQPuntualidad(res.data.qPuntualidad ?? 0);
    setQRecomendacion(res.data.qRecomendacion ?? 0);
    setCommentDraft(res.data.ratingComment ?? "");
    setSurveyNotes(res.data.surveyNotes ?? "");
  }

  useEffect(() => {
    load();
    api.get<CompanySettings>("/company").then((res) => setCompany(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShare(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function updateField(patch: Partial<Order>) {
    await api.patch(`/orders/${id}`, patch);
    load();
  }

  async function saveSurvey() {
    await api.patch(`/orders/${id}`, {
      rating: ratingDraft || undefined,
      qCalidad: qCalidad || undefined,
      qPuntualidad: qPuntualidad || undefined,
      qRecomendacion: qRecomendacion || undefined,
      ratingComment: commentDraft || undefined,
      surveyNotes: surveyNotes || undefined,
    });
    load();
  }

  async function copyText() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(orderShareText(order));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el navegador puede negar el permiso de portapapeles; no es crítico */
    }
  }

  if (!order) return <p className="text-sm text-gray-500">Cargando...</p>;

  const missing = surveyMissing(order);
  const whatsappPhone = (order.customer.phone ?? "").replace(/\D/g, "");
  const customerEmail = order.customer.email || order.customer.emails?.[0] || "";
  const waHref = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(orderShareText(order))}`;
  const mailHref = `mailto:${customerEmail}?subject=${encodeURIComponent("Pedido " + order.invoiceNumber)}&body=${encodeURIComponent(orderShareText(order))}`;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Pedido {order.invoiceNumber}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link to={`/pedidos/${order.id}/editar`} className="border text-sm rounded-md px-3 py-2">Editar</Link>
          <button onClick={() => printOrder(order, company)} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">Imprimir</button>
          <div className="relative" ref={shareRef}>
            <button onClick={() => setShowShare((v) => !v)} className="border text-sm rounded-md px-3 py-2">Compartir</button>
            {showShare && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border rounded-lg shadow-lg p-1.5 z-20 flex flex-col gap-0.5">
                <a href={waHref} target="_blank" rel="noreferrer" className="px-2.5 py-2 rounded-md text-sm font-medium hover:bg-gray-50">WhatsApp</a>
                <a href={mailHref} className="px-2.5 py-2 rounded-md text-sm font-medium hover:bg-gray-50">Email</a>
                <p className="text-[11px] text-gray-400 leading-snug mx-2.5 mt-0.5 pt-1 border-t">
                  El correo no puede adjuntar archivos automáticamente. Usa "Imprimir" para generar el PDF y adjúntalo manualmente.
                </p>
                <button type="button" onClick={copyText} className="px-2.5 py-2 rounded-md text-sm font-medium hover:bg-gray-50 text-left">
                  {copied ? "¡Copiado!" : "Copiar texto"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 print:hidden text-sm">
        <div>
          <label className="block font-medium mb-1">Estado</label>
          <select value={order.status} onChange={(e) => updateField({ status: e.target.value as OrderStatus })} className="border rounded-md px-2 py-1">
            {statusOptions.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Pago</label>
          <select value={order.paymentStatus} onChange={(e) => updateField({ paymentStatus: e.target.value as Order["paymentStatus"] })} className="border rounded-md px-2 py-1">
            {paymentOptions.map((p) => <option key={p} value={p}>{PAY_LABEL[p]}</option>)}
          </select>
        </div>
        {order.deliveryPerson && (
          <div>
            <label className="block font-medium mb-1 text-gray-500">Domiciliario</label>
            <p className="pt-1">{order.deliveryPerson.name}</p>
          </div>
        )}
        {order.isThirdPartyDelivery && (
          <div>
            <label className="block font-medium mb-1 text-gray-500">Transportador</label>
            <p className="pt-1">{order.thirdPartyDriverName} {order.thirdPartyPlate && `(${order.thirdPartyPlate})`}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_1.3fr] gap-4">
        {order.status === "DELIVERED" && order.surveySelected && (
          <div className="bg-white border rounded-lg p-4 space-y-3 print:hidden h-fit">
            <h3 className="font-medium text-sm">Encuesta de satisfacción</h3>
            {missing.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Falta: {missing.join(", ")}.
                {whatsappPhone && (
                  <a className="ml-1 underline" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent("¡Hola! ¿Nos ayudas con una breve encuesta sobre tu pedido " + order.invoiceNumber + "? Gracias 🌸")}`}>
                    Contactar
                  </a>
                )}
              </p>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Calificación general</p>
              <Stars value={ratingDraft} onChange={setRatingDraft} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Calidad del arreglo</p>
              <Stars value={qCalidad} onChange={setQCalidad} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Puntualidad de la entrega</p>
              <Stars value={qPuntualidad} onChange={setQPuntualidad} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">¿Nos recomendarías?</p>
              <Stars value={qRecomendacion} onChange={setQRecomendacion} />
            </div>
            <textarea placeholder="Comentario del cliente" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
            <textarea placeholder="Notas internas (opcional)" value={surveyNotes} onChange={(e) => setSurveyNotes(e.target.value)} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
            <button onClick={saveSurvey} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5">Guardar encuesta</button>
          </div>
        )}

        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex justify-between">
            <div>
              {order.store?.logo ? (
                <img src={order.store.logo} alt="" className="max-h-10 max-w-[160px] object-contain mb-1" />
              ) : (
                <h2 className="text-lg font-bold text-pink-700">{company?.razonSocial ?? "compañíafloral"}</h2>
              )}
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Certificado de pago</p>
              <p className="text-sm text-gray-500">{order.store?.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold">{order.invoiceNumber}</p>
              <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("es-CO")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Cliente</p>
              <p className="font-medium">{order.customer.name}</p>
              {order.customer.phone && <p className="text-gray-500">{order.customer.phone}</p>}
            </div>
            <div>
              <p className="text-gray-500">Enviar a</p>
              {order.recipientName ? (
                <>
                  <p className="font-medium">{order.recipientName}</p>
                  {order.recipientPhone && <p className="text-gray-500">{order.recipientPhone}</p>}
                </>
              ) : (
                <p className="text-gray-500">Mismo cliente</p>
              )}
            </div>
          </div>

          {(order.deliveryAddress || order.deliveryDate || order.scheduledShift || order.scheduledHour) && (
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              <div>
                <p className="text-gray-500">Entrega</p>
                <p className="font-medium">{order.deliveryAddress || "Recoge en tienda"}{order.deliveryCity && `, ${order.deliveryCity}`}</p>
                {(order.deliveryDate || order.scheduledShift || order.scheduledHour) && (
                  <p className="text-gray-500">
                    {order.deliveryDate && new Date(order.deliveryDate).toLocaleDateString("es-CO")} {order.scheduledShift} {order.scheduledHour}
                  </p>
                )}
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="py-2">{it.productName}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{money(it.unitPrice)}</td>
                  <td className="py-2 text-right">{money(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="text-right text-sm space-y-1">
              <p className="text-gray-500">Subtotal: {money(order.subtotal)}</p>
              {Number(order.discount) > 0 && <p className="text-gray-500">Descuento: -{money(order.discount)}</p>}
              {Number(order.deliveryFee) > 0 && <p className="text-gray-500">Envío: {money(order.deliveryFee)}</p>}
              <p className="text-2xl font-bold">{money(order.total)}</p>
            </div>
          </div>

          {(order.paymentMethod || order.occasion) && (
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              {order.paymentMethod && (
                <div>
                  <p className="text-gray-500">Forma de pago</p>
                  <p className="font-medium">{order.paymentMethod}</p>
                </div>
              )}
              {order.occasion && (
                <div>
                  <p className="text-gray-500">Ocasión</p>
                  <p className="font-medium">{order.occasion}</p>
                </div>
              )}
            </div>
          )}

          {order.cardMessage && (
            <div className="border-t pt-4">
              <p className="text-gray-500 text-sm">Mensaje de la tarjeta</p>
              <p className="italic">"{order.cardMessage}"</p>
            </div>
          )}

          {order.notes && (
            <div className="border-t pt-4 print:hidden">
              <p className="text-sm text-gray-500">Anotaciones internas</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {company?.resolution && <p className="text-[11px] text-gray-400 border-t pt-3">{company.resolution}</p>}
        </div>
      </div>
    </div>
  );
}
