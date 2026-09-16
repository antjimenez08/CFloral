import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Order } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { occasionLabel, orderStatusColor, orderStatusLabel } from "../../lib/labels";

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
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="w-28">Factura</span>
          <span className="flex-1">Cliente</span>
          <span className="w-32">Ocasión</span>
          <span className="w-32">Estado</span>
          <span className="w-24 text-right">Total</span>
        </div>
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/pedidos/${o.id}`}
            className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm hover:bg-pink-50"
          >
            <span className="w-28 font-mono">
              {o.invoiceNumber} {o.isRush && <span className="text-red-600 font-semibold">•</span>}
            </span>
            <span className="flex-1">{o.customer.name}</span>
            <span className="w-32 text-gray-500">{occasionLabel[o.occasion]}</span>
            <span className="w-32">
              <span className={`px-2 py-0.5 rounded-full text-xs ${orderStatusColor[o.status]}`}>
                {orderStatusLabel[o.status]}
              </span>
            </span>
            <span className="w-24 sm:text-right">${Number(o.total).toFixed(2)}</span>
          </Link>
        ))}
        {orders.length === 0 && <p className="p-4 text-sm text-gray-500">Sin pedidos todavía.</p>}
      </div>
    </div>
  );
}
