import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Order, OrderStatus } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { orderStatusLabel } from "../../lib/labels";

const FLOW: OrderStatus[] = ["PENDING", "IN_PROGRESS", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Iniciar elaboración",
  IN_PROGRESS: "Marcar listo",
  READY_FOR_PICKUP: "Enviar",
  OUT_FOR_DELIVERY: "Marcar entregado",
};

export default function DespachosBoard() {
  const { currentStoreId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!currentStoreId) return;
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((res) => setOrders(res.data));
  }

  useEffect(load, [currentStoreId]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setLoading(true);
    try {
      await api.patch(`/orders/${orderId}`, { status });
      load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Despachos</h1>
      <p className="text-sm text-gray-500">
        Gestiona la elaboración, el despacho y la entrega de los pedidos de esta tienda.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {FLOW.map((status) => {
          const inColumn = orders.filter((o) => o.status === status);
          const prevIndex = FLOW.indexOf(status) - 1;
          const prevStatus = prevIndex >= 0 ? FLOW[prevIndex] : null;
          return (
            <div key={status} className="bg-pink-50 rounded-lg p-3">
              <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                {orderStatusLabel[status]}
                <span className="bg-white rounded-full px-2 text-xs text-gray-500">{inColumn.length}</span>
              </div>
              <div className="space-y-2">
                {inColumn.length === 0 && <p className="text-xs text-gray-400 px-1">Sin pedidos</p>}
                {inColumn.map((o) => (
                  <div key={o.id} className="bg-white rounded-md border p-2 text-sm space-y-1">
                    <Link to={`/pedidos/${o.id}`} className="font-mono text-xs text-pink-700 hover:underline">
                      {o.invoiceNumber}
                    </Link>
                    <div className="font-medium">{o.customer.name}</div>
                    {o.recipientName && <div className="text-xs text-gray-500">Enviar a: {o.recipientName}</div>}
                    <div className="flex gap-1 pt-1">
                      {prevStatus && (
                        <button
                          disabled={loading}
                          onClick={() => updateStatus(o.id, prevStatus)}
                          className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                        >
                          ‹ Regresar
                        </button>
                      )}
                      {NEXT_LABEL[status] && (
                        <button
                          disabled={loading}
                          onClick={() => updateStatus(o.id, FLOW[FLOW.indexOf(status) + 1])}
                          className="text-xs bg-pink-600 text-white rounded px-2 py-1 hover:bg-pink-700 disabled:opacity-50"
                        >
                          {NEXT_LABEL[status]} ›
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
