import { useEffect, useState } from "react";
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

function printOrder(order: Order, company: CompanySettings | null) {
  const win = window.open("", "_blank");
  if (!win) return;
  const itemsHtml = order.items
    .map((it) => `<tr><td>${it.productName}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${money(it.unitPrice)}</td><td style="text-align:right">${money(it.subtotal)}</td></tr>`)
    .join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${order.invoiceNumber}</title>
    <style>
      @page { size: 5.5in 5in; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #232329; }
      h1 { font-size: 16px; margin: 0; color: #db2777; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { padding: 4px 2px; border-bottom: 1px solid #eee; text-align: left; }
      .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 8px; }
      .msg { background: #fdf2f8; border-radius: 8px; padding: 8px; font-style: italic; margin-top: 8px; }
      .notes { border: 1px dashed #999; padding: 8px; margin-top: 8px; font-size: 11px; }
      .toolbar { margin-bottom: 10px; }
      @media print { .toolbar { display: none; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
    <h1>${company?.razonSocial ?? "compañíafloral"}</h1>
    <p>${company?.nit ? "NIT " + company.nit : ""} ${company?.address ?? ""}</p>
    <p><strong>${order.invoiceNumber}</strong> — ${new Date(order.createdAt).toLocaleDateString("es-CO")}</p>
    <p>Cliente: <strong>${order.customer.name}</strong> ${order.customer.phone ?? ""}</p>
    ${order.recipientName ? `<p>Destinatario: <strong>${order.recipientName}</strong>${order.deliveryAddress ? " — " + order.deliveryAddress : ""}</p>` : ""}
    <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table>
    <p class="total">Total: ${money(order.total)}</p>
    ${order.cardMessage ? `<div class="msg">"${order.cardMessage}"</div>` : ""}
    ${order.notes ? `<div class="notes"><strong>Anotaciones internas (no mostrar al cliente):</strong><br>${order.notes}</div>` : ""}
    ${company?.resolution ? `<p style="font-size:10px;color:#888;margin-top:10px">${company.resolution}</p>` : ""}
    <script>setTimeout(()=>window.print(),250)</script>
    </body></html>`);
  win.document.close();
}

function orderShareText(order: Order): string {
  const lines = [
    `Pedido ${order.invoiceNumber} — compañíafloral`,
    `Cliente: ${order.customer.name}`,
    order.recipientName ? `Para: ${order.recipientName}` : "",
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

  if (!order) return <p className="text-sm text-gray-500">Cargando...</p>;

  const missing = surveyMissing(order);
  const whatsappPhone = (order.customer.phone ?? "").replace(/\D/g, "");

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Pedido {order.invoiceNumber}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link to={`/pedidos/${order.id}/editar`} className="border text-sm rounded-md px-3 py-2">Editar</Link>
          <button onClick={() => printOrder(order, company)} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">Imprimir</button>
          {whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(orderShareText(order))}`}
              target="_blank"
              rel="noreferrer"
              className="border text-sm rounded-md px-3 py-2"
            >
              Compartir WhatsApp
            </a>
          )}
          {order.customer.email && (
            <a
              href={`mailto:${order.customer.email}?subject=${encodeURIComponent("Tu pedido " + order.invoiceNumber)}&body=${encodeURIComponent(orderShareText(order))}`}
              className="border text-sm rounded-md px-3 py-2"
            >
              Compartir Email
            </a>
          )}
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
              <h2 className="text-lg font-bold text-pink-700">{company?.razonSocial ?? "compañíafloral"}</h2>
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
            {order.occasion && (
              <div>
                <p className="text-gray-500">Ocasión</p>
                <p className="font-medium">{order.occasion}</p>
              </div>
            )}
          </div>

          {(order.recipientName || order.deliveryAddress) && (
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              {order.recipientName && (
                <div>
                  <p className="text-gray-500">Destinatario</p>
                  <p className="font-medium">{order.recipientName}</p>
                  {order.recipientPhone && <p className="text-gray-500">{order.recipientPhone}</p>}
                </div>
              )}
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

          {order.cardMessage && (
            <div className="border-t pt-4">
              <p className="text-gray-500 text-sm">Mensaje de la tarjeta</p>
              <p className="italic">"{order.cardMessage}"</p>
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

          {order.notes && (
            <div className="border-t pt-4 print:hidden">
              <p className="text-sm text-gray-500">Anotaciones internas</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
