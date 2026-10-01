import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Order } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { orderZone, ZONES } from "./zoneUtils";

/** Hash determinístico simple: mismo id -> siempre el mismo número. */
function hashStr(s: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

function pinPosition(orderId: string) {
  // Mantiene el pin lejos de los bordes de su caja de zona (10%-85%).
  const x = 10 + (hashStr(orderId, 17) % 76);
  const y = 10 + (hashStr(orderId, 53) % 76);
  return { left: `${x}%`, top: `${y}%` };
}

function deliveryPersonLabel(order: Order): string {
  if (order.isThirdPartyDelivery) {
    const driver = order.thirdPartyDriverName || "Terceros";
    const plate = order.thirdPartyPlate ? ` (${order.thirdPartyPlate})` : "";
    return `Taxi/Uber/Terceros: ${driver}${plate}`;
  }
  return order.deliveryPerson?.name || "Sin asignar";
}

export default function SeguimientoTab() {
  const { currentStoreId } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!currentStoreId) return;
    api
      .get<Order[]>("/orders", { params: { storeId: currentStoreId, status: "OUT_FOR_DELIVERY" } })
      .then((res) => setOrders(res.data));
  }, [currentStoreId]);

  const withZone = orders
    .map((o) => ({ order: o, zone: orderZone(o) }))
    .filter((x) => x.zone !== "");
  const withoutZone = orders.filter((o) => orderZone(o) === "");

  const ordersByZone: Record<string, Order[]> = {};
  for (const z of ZONES) ordersByZone[z] = [];
  for (const { order, zone } of withZone) ordersByZone[zone].push(order);

  const indexById = new Map<string, number>();
  withZone.forEach(({ order }, i) => indexById.set(order.id, i + 1));

  function goTo(orderId: string) {
    navigate(`/pedidos/${orderId}`);
  }

  function ZoneBox({ zone }: { zone: string }) {
    const zoneOrders = ordersByZone[zone] || [];
    return (
      <div className="relative bg-pink-50 border rounded-lg h-32 sm:h-40">
        <div className="absolute top-1 left-2 text-xs font-semibold text-gray-500">{zone}</div>
        {zoneOrders.map((o) => (
          <button
            key={o.id}
            onClick={() => goTo(o.id)}
            title={`${o.invoiceNumber} — ${o.recipientName || o.customer.name}`}
            style={pinPosition(o.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-pink-600 text-white text-[11px] font-semibold flex items-center justify-center shadow hover:bg-pink-700"
          >
            {indexById.get(o.id)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Mapa de zonas (ilustrativo, no GPS)</h2>
        <div
          className="grid gap-2 max-w-xl"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateAreas: `". norte ." "oeste tienda oriente" ". sur ."`,
          }}
        >
          <div style={{ gridArea: "norte" }}>
            <ZoneBox zone="Norte" />
          </div>
          <div style={{ gridArea: "oeste" }}>
            <ZoneBox zone="Oeste" />
          </div>
          <div
            style={{ gridArea: "tienda" }}
            className="flex items-center justify-center bg-pink-100 border-2 border-pink-300 rounded-lg h-32 sm:h-40 text-sm font-semibold text-pink-700"
          >
            Tienda
          </div>
          <div style={{ gridArea: "oriente" }}>
            <ZoneBox zone="Oriente" />
          </div>
          <div style={{ gridArea: "sur" }}>
            <ZoneBox zone="Sur" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">En camino</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-pink-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Destinatario</th>
                <th className="px-3 py-2">Zona</th>
                <th className="px-3 py-2">Domiciliario</th>
              </tr>
            </thead>
            <tbody>
              {withZone.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">
                    No hay pedidos en camino con ubicación conocida.
                  </td>
                </tr>
              )}
              {withZone.map(({ order, zone }) => (
                <tr
                  key={order.id}
                  onClick={() => goTo(order.id)}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-2 text-xs text-gray-400">{indexById.get(order.id)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-pink-700">{order.invoiceNumber}</td>
                  <td className="px-3 py-2">{order.recipientName || order.customer.name}</td>
                  <td className="px-3 py-2">{zone}</td>
                  <td className="px-3 py-2">{deliveryPersonLabel(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Sin ubicación conocida</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-pink-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Destinatario</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2">Domiciliario</th>
              </tr>
            </thead>
            <tbody>
              {withoutZone.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">
                    Todos los pedidos en camino tienen zona identificada.
                  </td>
                </tr>
              )}
              {withoutZone.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => goTo(order.id)}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-2 font-mono text-xs text-pink-700">{order.invoiceNumber}</td>
                  <td className="px-3 py-2">{order.recipientName || order.customer.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{order.deliveryAddress}</td>
                  <td className="px-3 py-2">{deliveryPersonLabel(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
