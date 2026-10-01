import { DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, EmployeeUser, Order, OrderStatus, STATUS_FLOW, STATUS_LABEL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { printDispatchOrder, printGiftCard } from "./printDocs";
import { orderZone, zoneSortOrder, ZONES } from "./zoneUtils";

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  IN_PROGRESS: "Iniciar elaboración",
  READY: "Marcar listo",
  OUT_FOR_DELIVERY: "Enviar",
  DELIVERED: "Marcar entregado",
};

const SHIFTS = ["Mañana", "Tarde", "Noche"];

const THIRD_PARTY = "THIRD_PARTY";

function buildNotifyUrl(order: Order, newStatus: OrderStatus): string | null {
  const digits = (order.customer.phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const estadoLowercase = STATUS_LABEL[newStatus].toLowerCase();
  const message = `¡Hola ${order.customer.name}! 🌸 Tu pedido ${order.invoiceNumber} de compañíafloral cambió de estado: ahora está *${estadoLowercase}*. Te seguimos contando cómo va. 💐`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function TableroTab() {
  const { currentStoreId, user, can } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [domiciliarios, setDomiciliarios] = useState<EmployeeUser[] | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);

  const [filterDate, setFilterDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterZone, setFilterZone] = useState("");

  function load() {
    if (!currentStoreId) return;
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((res) => setOrders(res.data));
  }

  useEffect(load, [currentStoreId]);

  useEffect(() => {
    if (!can("empleados")) {
      setDomiciliarios(null);
      return;
    }
    api
      .get<EmployeeUser[]>("/users")
      .then((res) => setDomiciliarios(res.data.filter((u) => u.position === "Domiciliario" && u.active)))
      .catch(() => setDomiciliarios(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patchOrder(orderId: string, patch: Record<string, unknown>) {
    await api.patch(`/orders/${orderId}`, patch);
    load();
  }

  async function changeStatus(order: Order, newStatus: OrderStatus) {
    const patch: Record<string, unknown> = { status: newStatus };
    const url = buildNotifyUrl(order, newStatus);
    if (url) {
      window.open(url, "_blank");
      patch.notifiedStatus = newStatus;
    }
    await patchOrder(order.id, patch);
  }

  function clearFilters() {
    setFilterDate("");
    setFilterMonth("");
    setFilterZone("");
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === "CANCELLED") return false;
      if (filterDate && o.createdAt.slice(0, 10) !== filterDate) return false;
      if (filterMonth && o.createdAt.slice(0, 7) !== filterMonth) return false;
      if (filterZone && orderZone(o) !== filterZone) return false;
      return true;
    });
  }, [orders, filterDate, filterMonth, filterZone]);

  function ordersFor(status: OrderStatus) {
    return filteredOrders.filter((o) => o.status === status);
  }

  async function printAllReady(columnOrders: Order[]) {
    const sorted = [...columnOrders].sort((a, b) => zoneSortOrder(orderZone(a)) - zoneSortOrder(orderZone(b)));
    for (const o of sorted) {
      printGiftCard(o);
      printDispatchOrder(o);
    }
    await Promise.all(sorted.map((o) => api.patch(`/orders/${o.id}`, { cardPrinted: true, dispatchPrinted: true })));
    load();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, status: OrderStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData("text/plain");
    const order = orders.find((o) => o.id === orderId);
    if (order && order.status !== status) {
      changeStatus(order, status);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-pink-50 rounded-lg p-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Mes</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Zona</label>
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={clearFilters}
          className="text-sm border rounded px-3 py-1.5 hover:bg-white"
        >
          Limpiar filtro
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {STATUS_FLOW.map((status) => {
          const columnOrders = ordersFor(status);
          const idx = STATUS_FLOW.indexOf(status);
          const prevStatus = idx > 0 ? STATUS_FLOW[idx - 1] : null;
          const nextStatus = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;

          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColumn !== status) setDragOverColumn(status);
              }}
              onDragLeave={() => setDragOverColumn((cur) => (cur === status ? null : cur))}
              onDrop={(e) => handleDrop(e, status)}
              className={`flex-1 min-w-[240px] rounded-lg p-3 transition-colors ${
                dragOverColumn === status ? "bg-pink-100 ring-2 ring-pink-300" : "bg-pink-50"
              }`}
            >
              <div className="font-semibold text-sm mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {STATUS_LABEL[status]}
                  <span className="bg-white rounded-full px-2 text-xs text-gray-500">{columnOrders.length}</span>
                </span>
                {status === "READY" && columnOrders.length > 0 && (
                  <button
                    onClick={() => printAllReady(columnOrders)}
                    className="text-xs border rounded px-2 py-1 bg-white hover:bg-gray-50"
                  >
                    Imprimir todas
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {columnOrders.length === 0 && <p className="text-xs text-gray-400 px-1">Sin pedidos</p>}
                {columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isAdmin={user?.role === "ADMIN"}
                    domiciliarios={domiciliarios}
                    prevStatus={prevStatus}
                    nextStatus={nextStatus}
                    nextLabel={nextStatus ? NEXT_LABEL[nextStatus] : undefined}
                    onDragStartOrder={(e) => e.dataTransfer.setData("text/plain", order.id)}
                    onChangeStatus={changeStatus}
                    onPatch={patchOrder}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isAdmin,
  domiciliarios,
  prevStatus,
  nextStatus,
  nextLabel,
  onDragStartOrder,
  onChangeStatus,
  onPatch,
}: {
  order: Order;
  isAdmin: boolean;
  domiciliarios: EmployeeUser[] | null;
  prevStatus: OrderStatus | null;
  nextStatus: OrderStatus | null;
  nextLabel: string | undefined;
  onDragStartOrder: (e: DragEvent<HTMLDivElement>) => void;
  onChangeStatus: (order: Order, status: OrderStatus) => void;
  onPatch: (orderId: string, patch: Record<string, unknown>) => void;
}) {
  const itemSummary = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
  const notified = order.notifiedStatus === order.status;

  const assignValue = order.isThirdPartyDelivery ? THIRD_PARTY : order.deliveryPersonId || "";

  function handleAssignChange(value: string) {
    if (value === "") {
      onPatch(order.id, { deliveryPersonId: null, isThirdPartyDelivery: false });
    } else if (value === THIRD_PARTY) {
      onPatch(order.id, { deliveryPersonId: null, isThirdPartyDelivery: true });
    } else {
      onPatch(order.id, { deliveryPersonId: value, isThirdPartyDelivery: false });
    }
  }

  return (
    <div
      draggable
      onDragStart={onDragStartOrder}
      className="bg-white rounded-md border p-2 text-sm space-y-2 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/pedidos/${order.id}`} className="font-mono text-xs text-pink-700 hover:underline">
          {order.invoiceNumber}
        </Link>
        {notified && (
          <span className="text-[11px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            ✓ Cliente notificado
          </span>
        )}
      </div>

      {itemSummary && <div className="text-xs text-gray-600">{itemSummary}</div>}

      <div>
        <div className="font-medium">{order.recipientName || order.customer.name}</div>
        {order.deliveryAddress && <div className="text-xs text-gray-500">{order.deliveryAddress}</div>}
        {isAdmin && order.store?.name && <div className="text-[11px] text-gray-400">{order.store.name}</div>}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <input
          type="date"
          value={order.deliveryDate ? order.deliveryDate.slice(0, 10) : ""}
          onChange={(e) =>
            onPatch(order.id, { deliveryDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })
          }
          className="border rounded px-1 py-0.5 text-xs"
        />
        <input
          type="time"
          value={order.scheduledHour || ""}
          onChange={(e) => onPatch(order.id, { scheduledHour: e.target.value })}
          className="border rounded px-1 py-0.5 text-xs"
        />
        <select
          value={order.scheduledShift || ""}
          onChange={(e) => onPatch(order.id, { scheduledShift: e.target.value })}
          className="border rounded px-1 py-0.5 text-xs col-span-2"
        >
          <option value="">Jornada…</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <select
          value={assignValue}
          onChange={(e) => handleAssignChange(e.target.value)}
          className="border rounded px-1 py-0.5 text-xs w-full"
        >
          <option value="">Sin domiciliario…</option>
          {domiciliarios?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={THIRD_PARTY}>Taxi/Uber/Terceros</option>
        </select>
        {order.isThirdPartyDelivery && (
          <div className="grid grid-cols-2 gap-1">
            <input
              key={`driver-${order.id}`}
              defaultValue={order.thirdPartyDriverName || ""}
              placeholder="Conductor"
              onBlur={(e) => onPatch(order.id, { thirdPartyDriverName: e.target.value })}
              className="border rounded px-1 py-0.5 text-xs"
            />
            <input
              key={`plate-${order.id}`}
              defaultValue={order.thirdPartyPlate || ""}
              placeholder="Placa"
              onBlur={(e) => onPatch(order.id, { thirdPartyPlate: e.target.value })}
              className="border rounded px-1 py-0.5 text-xs"
            />
          </div>
        )}
      </div>

      {order.status === "READY" && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => {
              printGiftCard(order);
              onPatch(order.id, { cardPrinted: true });
            }}
            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
          >
            {order.cardPrinted ? "Reimprimir tarjeta ✓" : "Imprimir tarjeta"}
          </button>
          <button
            onClick={() => {
              printDispatchOrder(order);
              onPatch(order.id, { dispatchPrinted: true });
            }}
            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
          >
            {order.dispatchPrinted ? "Reimprimir orden ✓" : "Orden de despacho"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-1 pt-1">
        <Link to={`/pedidos/${order.id}`} className="text-xs text-gray-500 hover:underline">
          Ver pedido
        </Link>
        <div className="flex gap-1">
          {prevStatus && (
            <button
              onClick={() => onChangeStatus(order, prevStatus)}
              className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
            >
              ← Regresar
            </button>
          )}
          {nextStatus && nextLabel && (
            <button
              onClick={() => onChangeStatus(order, nextStatus)}
              className="text-xs bg-pink-600 text-white rounded px-2 py-1 hover:bg-pink-700"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
