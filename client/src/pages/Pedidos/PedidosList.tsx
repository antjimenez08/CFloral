import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Order, OrderStatus, PAY_LABEL, STATUS_LABEL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money, orderStatusColor, paymentStatusColor } from "../../lib/labels";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

type OrderSortKey = "invoiceNumber" | "customerName" | "status" | "total";

function surveyMissingFields(o: Order): boolean {
  if (!o.surveySelected) return false;
  return !o.rating || !o.qCalidad || !o.qPuntualidad || !o.qRecomendacion || !(o.ratingComment ?? "").trim();
}

export default function PedidosList() {
  const { currentStoreId, can } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [payFilter, setPayFilter] = useState<Order["paymentStatus"] | "">("");
  const [sortKey, setSortKey] = useState<OrderSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: OrderSortKey) {
    toggleSort(key, sortKey, sortDir, setSortKey, setSortDir);
  }

  function load() {
    if (!currentStoreId) return;
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((res) => setOrders(res.data));
  }

  useEffect(load, [currentStoreId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = orders
      .filter((o) => !statusFilter || o.status === statusFilter)
      .filter((o) => !payFilter || o.paymentStatus === payFilter)
      .filter(
        (o) =>
          !term ||
          o.invoiceNumber.toLowerCase().includes(term) ||
          o.customer.name.toLowerCase().includes(term)
      );
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = sortKey === "customerName" ? a.customer.name : sortKey === "total" ? Number(a.total) : a[sortKey];
        const bv = sortKey === "customerName" ? b.customer.name : sortKey === "total" ? Number(b.total) : b[sortKey];
        const cmp = sortKey === "total" ? (av as number) - (bv as number) : compareValues(av, bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [orders, search, statusFilter, payFilter, sortKey, sortDir]);

  async function repeat(o: Order) {
    navigate(`/pedidos/nuevo?repeatId=${o.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        {can("pedidos") && (
          <Link to="/pedidos/nuevo" className="bg-[var(--accent,#db2777)] text-white text-sm rounded-md px-3 py-2">
            Nuevo pedido
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar por factura o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")} className="border rounded-md px-2 py-2 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as Order["paymentStatus"] | "")} className="border rounded-md px-2 py-2 text-sm">
          <option value="">Todos los pagos</option>
          {Object.entries(PAY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="w-28"><SortHeader label="Pedido" sortKey="invoiceNumber" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="flex-1"><SortHeader label="Cliente" sortKey="customerName" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="flex-1">Enviado a</span>
          <span className="w-32"><SortHeader label="Estado" sortKey="status" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-28">Pago</span>
          <span className="w-24 text-right"><SortHeader label="Total" sortKey="total" active={sortKey} dir={sortDir} onClick={onSort} className="justify-end" /></span>
          <span className="w-40"></span>
        </div>
        {filtered.map((o) => (
          <div key={o.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm hover:bg-pink-50">
            <Link to={`/pedidos/${o.id}`} className="w-28 font-mono">{o.invoiceNumber}</Link>
            <Link to={`/pedidos/${o.id}`} className="flex-1">{o.customer.name}</Link>
            <Link to={`/pedidos/${o.id}`} className="flex-1 text-gray-500">{o.recipientName || "Mismo cliente"}</Link>
            <span className="w-32">
              <span className={`px-2 py-0.5 rounded-full text-xs ${orderStatusColor[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            </span>
            <span className="w-28">
              <span className={`px-2 py-0.5 rounded-full text-xs ${paymentStatusColor[o.paymentStatus]}`}>{PAY_LABEL[o.paymentStatus]}</span>
            </span>
            <span className="w-24 sm:text-right">{money(o.total)}</span>
            <span className="w-40 flex gap-2 justify-end">
              <button type="button" onClick={() => repeat(o)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                Repetir
              </button>
              {surveyMissingFields(o) && (
                <Link to={`/pedidos/${o.id}`} className="text-xs border rounded px-2 py-1 bg-amber-50 border-amber-300 text-amber-800">
                  Encuesta
                </Link>
              )}
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-500">Sin pedidos que coincidan.</p>}
      </div>
    </div>
  );
}
