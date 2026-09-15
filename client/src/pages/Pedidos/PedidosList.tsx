import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Order } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const statusLabel: Record<Order["status"], string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const statusColor: Record<Order["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function PedidosList() {
  const { currentStoreId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((res) => setOrders(res.data));
  }, [currentStoreId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Link to="/pedidos/nuevo" className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
          Nuevo pedido
        </Link>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        <div className="p-3 flex text-xs font-semibold text-gray-500 uppercase">
          <span className="w-28">Factura</span>
          <span className="flex-1">Cliente</span>
          <span className="w-28">Estado</span>
          <span className="w-24 text-right">Total</span>
        </div>
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/pedidos/${o.id}`}
            className="p-3 flex text-sm items-center hover:bg-pink-50"
          >
            <span className="w-28 font-mono">{o.invoiceNumber}</span>
            <span className="flex-1">{o.customer.name}</span>
            <span className={`w-28`}>
              <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[o.status]}`}>
                {statusLabel[o.status]}
              </span>
            </span>
            <span className="w-24 text-right">${Number(o.total).toFixed(2)}</span>
          </Link>
        ))}
        {orders.length === 0 && <p className="p-4 text-sm text-gray-500">Sin pedidos todavía.</p>}
      </div>
    </div>
  );
}
