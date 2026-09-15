import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Order } from "../../api/client";

const statusOptions: Order["status"][] = ["PENDING", "IN_PROGRESS", "DELIVERED", "CANCELLED"];
const statusLabel: Record<Order["status"], string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const paymentOptions: Order["paymentStatus"][] = ["UNPAID", "PARTIAL", "PAID"];
const paymentLabel: Record<Order["paymentStatus"], string> = {
  UNPAID: "Sin pagar",
  PARTIAL: "Pago parcial",
  PAID: "Pagado",
};

export default function PedidoDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);

  async function load() {
    const res = await api.get<Order>(`/orders/${id}`);
    setOrder(res.data);
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

  if (!order) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Pedido {order.invoiceNumber}</h1>
        <button onClick={() => window.print()} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
          Imprimir factura
        </button>
      </div>

      <div className="flex gap-4 print:hidden text-sm">
        <div>
          <label className="block font-medium mb-1">Estado</label>
          <select
            value={order.status}
            onChange={(e) => updateStatus(e.target.value as Order["status"])}
            className="border rounded-md px-2 py-1"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Pago</label>
          <select
            value={order.paymentStatus}
            onChange={(e) => updatePayment(e.target.value as Order["paymentStatus"])}
            className="border rounded-md px-2 py-1"
          >
            {paymentOptions.map((p) => (
              <option key={p} value={p}>
                {paymentLabel[p]}
              </option>
            ))}
          </select>
        </div>
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

        <div>
          <p className="text-sm text-gray-500">Cliente</p>
          <p className="font-medium">{order.customer.name}</p>
          {order.customer.phone && <p className="text-sm text-gray-500">{order.customer.phone}</p>}
        </div>

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
          <div className="text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">${Number(order.total).toFixed(2)}</p>
          </div>
        </div>

        {order.notes && (
          <div>
            <p className="text-sm text-gray-500">Notas</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
