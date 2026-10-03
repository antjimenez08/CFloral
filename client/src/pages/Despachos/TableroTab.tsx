import { DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, DirectoryUser, Order, OrderStatus, STATUS_FLOW, STATUS_LABEL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { printAllGiftCardsAndDispatch, printDispatchOrder, printGiftCard } from "./printDocs";
import { orderZone, zoneSortOrder, ZONES } from "./zoneUtils";

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  IN_PROGRESS: "Iniciar elaboración",
  READY: "Marcar listo",
  OUT_FOR_DELIVERY: "Enviar",
  DELIVERED: "Marcar entregado",
};

const SHIFTS = ["Mañana", "Tarde", "Noche"];

const THIRD_PARTY = "THIRD_PARTY";

type GroupBy = "status" | "date" | "shift" | "hour";

const GROUP_LABEL: Record<GroupBy, string> = {
  status: "Estado",
  date: "Fecha",
  shift: "Jornada",
  hour: "Hora",
};

interface BoardColumn {
  key: string;
  label: string;
  orders: Order[];
  status?: OrderStatus;
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function buildNotifyUrl(order: Order, newStatus: OrderStatus): string | null {
  const digits = (order.customer.phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const estadoLowercase = STATUS_LABEL[newStatus].toLowerCase();
  const message = `¡Hola ${order.customer.name}! 🌸 Tu pedido ${order.invoiceNumber} de compañíafloral cambió de estado: ahora está *${estadoLowercase}*. Te seguimos contando cómo va. 💐`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function TableroTab() {
  const { currentStoreId, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [domiciliarios, setDomiciliarios] = useState<DirectoryUser[] | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const [filterDate, setFilterDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");

  function load() {
    if (!currentStoreId) return;
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((res) => setOrders(res.data));
  }

  useEffect(load, [currentStoreId]);

  useEffect(() => {
    api
      .get<DirectoryUser[]>("/users/directory")
      .then((res) => setDomiciliarios(res.data.filter((u) => u.position === "Domiciliario")))
      .catch(() => setDomiciliarios(null));
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

  /// Columnas del tablero según el criterio de agrupación elegido (mockup §4.8): por
  /// defecto Estado (el flujo de producción/despacho); también se puede agrupar por
  /// Fecha programada, Jornada u Hora programada para ver el día de trabajo de otra forma.
  const columns = useMemo<BoardColumn[]>(() => {
    if (groupBy === "status") {
      return STATUS_FLOW.map((status) => ({
        key: status,
        label: STATUS_LABEL[status],
        status,
        orders: filteredOrders.filter((o) => o.status === status),
      }));
    }
    if (groupBy === "shift") {
      const cols: BoardColumn[] = SHIFTS.map((s) => ({
        key: s,
        label: s,
        orders: filteredOrders.filter((o) => o.scheduledShift === s),
      }));
      cols.push({ key: "", label: "Sin jornada", orders: filteredOrders.filter((o) => !o.scheduledShift) });
      return cols;
    }
    if (groupBy === "hour") {
      const hours = Array.from(new Set(filteredOrders.map((o) => o.scheduledHour).filter(Boolean))).sort() as string[];
      const cols: BoardColumn[] = hours.map((h) => ({
        key: h,
        label: h,
        orders: filteredOrders.filter((o) => o.scheduledHour === h),
      }));
      cols.push({ key: "", label: "Sin hora", orders: filteredOrders.filter((o) => !o.scheduledHour) });
      return cols;
    }
    // date
    const dates = Array.from(
      new Set(filteredOrders.map((o) => (o.deliveryDate ? o.deliveryDate.slice(0, 10) : "")).filter(Boolean))
    ).sort() as string[];
    const cols: BoardColumn[] = dates.map((d) => ({
      key: d,
      label: dateLabel(d),
      orders: filteredOrders.filter((o) => o.deliveryDate?.slice(0, 10) === d),
    }));
    cols.push({ key: "", label: "Sin fecha", orders: filteredOrders.filter((o) => !o.deliveryDate) });
    return cols;
  }, [filteredOrders, groupBy]);

  function patchForDrop(columnKey: string): Record<string, unknown> {
    if (groupBy === "shift") return { scheduledShift: columnKey || null };
    if (groupBy === "hour") return { scheduledHour: columnKey || null };
    if (groupBy === "date") {
      return { deliveryDate: columnKey ? new Date(`${columnKey}T00:00:00`).toISOString() : null };
    }
    return {};
  }

  async function printAllReady(columnOrders: Order[]) {
    const sorted = [...columnOrders].sort((a, b) => zoneSortOrder(orderZone(a)) - zoneSortOrder(orderZone(b)));
    printAllGiftCardsAndDispatch(sorted);
    await Promise.all(sorted.map((o) => api.patch(`/orders/${o.id}`, { cardPrinted: true, dispatchPrinted: true })));
    load();
  }

  /// Mueve un pedido a otra columna del tablero, sin importar si viene de soltar un
  /// arrastre (mouse) o de elegir "Mover a..." (la alternativa táctil, ya que el
  /// drag-and-drop HTML5 no es confiable en pantallas táctiles).
  function moveOrderToColumn(order: Order, column: BoardColumn) {
    if (groupBy === "status" && column.status) {
      if (order.status !== column.status) changeStatus(order, column.status);
      return;
    }
    patchOrder(order.id, patchForDrop(column.key));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, column: BoardColumn) {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData("text/plain");
    const order = orders.find((o) => o.id === orderId);
    if (order) moveOrderToColumn(order, column);
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">Agrupar tablero por</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="border rounded px-2 py-1 text-sm"
          >
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
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
        {columns.map((column) => (
          <div
            key={column.key || `${column.label}-empty`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverColumn !== column.key) setDragOverColumn(column.key);
            }}
            onDragLeave={() => setDragOverColumn((cur) => (cur === column.key ? null : cur))}
            onDrop={(e) => handleDrop(e, column)}
            className={`flex-1 min-w-[240px] rounded-lg p-3 transition-colors ${
              dragOverColumn === column.key ? "bg-pink-100 ring-2 ring-pink-300" : "bg-pink-50"
            }`}
          >
            <div className="font-semibold text-sm mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {column.label}
                <span className="bg-white rounded-full px-2 text-xs text-gray-500">{column.orders.length}</span>
              </span>
              {column.status === "READY" && column.orders.length > 0 && (
                <button
                  onClick={() => printAllReady(column.orders)}
                  className="text-xs border rounded px-2 py-1 bg-white hover:bg-gray-50"
                >
                  Imprimir todas
                </button>
              )}
            </div>

            <div className="space-y-2">
              {column.orders.length === 0 && <p className="text-xs text-gray-400 px-1">Sin pedidos</p>}
              {column.orders.map((order) => {
                const idx = STATUS_FLOW.indexOf(order.status);
                const prevStatus = idx > 0 ? STATUS_FLOW[idx - 1] : null;
                const nextStatus = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
                return (
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
                    moveColumns={columns}
                    currentColumnKey={column.key}
                    onMoveToColumn={(col) => moveOrderToColumn(order, col)}
                  />
                );
              })}
            </div>
          </div>
        ))}
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
  moveColumns,
  currentColumnKey,
  onMoveToColumn,
}: {
  order: Order;
  isAdmin: boolean;
  domiciliarios: DirectoryUser[] | null;
  prevStatus: OrderStatus | null;
  nextStatus: OrderStatus | null;
  nextLabel: string | undefined;
  onDragStartOrder: (e: DragEvent<HTMLDivElement>) => void;
  onChangeStatus: (order: Order, status: OrderStatus) => void;
  onPatch: (orderId: string, patch: Record<string, unknown>) => void;
  moveColumns: BoardColumn[];
  currentColumnKey: string;
  onMoveToColumn: (column: BoardColumn) => void;
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

      {moveColumns.length > 1 && (
        <select
          value={currentColumnKey}
          onChange={(e) => {
            const target = moveColumns.find((c) => c.key === e.target.value);
            if (target) onMoveToColumn(target);
          }}
          title="Alternativa al arrastre, útil en pantallas táctiles"
          className="border rounded px-1 py-0.5 text-xs w-full"
        >
          {moveColumns.map((c) => (
            <option key={c.key || "__none__"} value={c.key}>
              Mover a: {c.label}
            </option>
          ))}
        </select>
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
