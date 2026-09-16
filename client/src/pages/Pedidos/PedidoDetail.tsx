import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Order, OrderStatus } from "../../api/client";
import { channelLabel, occasionLabel, orderStatusLabel } from "../../lib/labels";

const statusOptions: OrderStatus[] = ["PENDING", "IN_PROGRESS", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const paymentOptions: Order["paymentStatus"][] = ["UNPAID", "PARTIAL", "PAID"];
const paymentLabel: Record<Order["paymentStatus"], string> = {
  UNPAID: "Sin pagar",
  PARTIAL: "Pago parcial",
  PAID: "Pagado",
};

export default function PedidoDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");

  async function load() {
    const res = await api.get<Order>(`/orders/${id}`);
    setOrder(res.data);
    setRatingDraft(res.data.rating ?? 0);
    setCommentDraft(res.data.ratingComment ?? "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: Order["status"]) {
    await api.patch(`/orders/${id}`, { status });
    load();
  }

  async function updatePayment(paymentStatus: Order["paymentStatus"]) {
    await api.patch(`/orders/${id}`, { paymentStatus });
    load();
  }

  async function saveRating() {
    await api.patch(`/orders/${id}`, { rating: ratingDraft, ratingComment: commentDraft || undefined });
    load();
  }

  if (!order) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Pedido {order.invoiceNumber}</h1>
        <button onClick={() => window.print()} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
          Imprimir factura
        </button>
      </div>

      <div className="flex flex-wrap gap-4 print:hidden text-sm">
        <div>
          <label className="block font-medium mb-1">Estado</label>
          <select value={order.status} onChange={(e) => updateStatus(e.target.value as Order["status"])} className="border rounded-md px-2 py-1">
            {statusOptions.map((s) => (
              <option key={s} value={s}>{orderStatusLabel[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Pago</label>
          <select value={order.paymentStatus} onChange={(e) => updatePayment(e.target.value as Order["paymentStatus"])} className="border rounded-md px-2 py-1">
            {paymentOptions.map((p) => (
              <option key={p} value={p}>{paymentLabel[p]}</option>
            ))}
          </select>
        </div>
        {order.isRush && (
          <span className="self-end bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">URGENTE</span>
        )}
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div className="flex justify-between">
          <div>
            <h2 className="text-lg font-bold text-pink-700">CFloral</h2>
            <p className="text-sm text-gray-500">{order.store?.name}</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold">{order.invoiceNumber}</p>
            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Cliente</p>
            <p className="font-medium">{order.customer.name}</p>
            {order.customer.phone && <p className="text-gray-500">{order.customer.phone}</p>}
          </div>
          <div>
            <p className="text-gray-500">Ocasión · Canal</p>
            <p className="font-medium">{occasionLabel[order.occasion]}</p>
            <p className="text-gray-500">{channelLabel[order.channel]}</p>
          </div>
        </div>

        {(order.recipientName || order.deliveryMethod === "DELIVERY") && (
          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            {order.recipientName && (
              <div>
                <p className="text-gray-500">Destinatario</p>
                <p className="font-medium">{order.recipientName}{order.recipientRelationship && ` (${order.recipientRelationship})`}</p>
                {order.recipientPhone && <p className="text-gray-500">{order.recipientPhone}</p>}
              </div>
            )}
            {order.deliveryMethod === "DELIVERY" ? (
              <div>
                <p className="text-gray-500">Entrega a domicilio</p>
                <p className="font-medium">{order.deliveryAddress}{order.deliveryCity && `, ${order.deliveryCity}`}</p>
                {order.deliveryWindow && <p className="text-gray-500">Ventana: {order.deliveryWindow}</p>}
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Entrega</p>
                <p className="font-medium">Recoge en tienda</p>
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
                <td className="py-2">{it.product.name}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">${Number(it.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-right">${Number(it.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="text-right text-sm space-y-1">
            <p className="text-gray-500">Subtotal: ${Number(order.subtotal).toFixed(2)}</p>
            {Number(order.discount) > 0 && <p className="text-gray-500">Descuento: -${Number(order.discount).toFixed(2)}</p>}
            {Number(order.deliveryFee) > 0 && <p className="text-gray-500">Envío: ${Number(order.deliveryFee).toFixed(2)}</p>}
            <p className="text-2xl font-bold">${Number(order.total).toFixed(2)}</p>
          </div>
        </div>

        {order.notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Notas</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4 print:hidden space-y-2">
        <h3 className="font-medium text-sm">Satisfacción del cliente</h3>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRatingDraft(n)}
              className={`text-2xl leading-none ${n <= ratingDraft ? "text-yellow-500" : "text-gray-300"}`}
              aria-label={`${n} estrellas`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          placeholder="Comentario del cliente (opcional)"
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
        <button onClick={saveRating} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5">
          Guardar calificación
        </button>
      </div>
    </div>
  );
}
