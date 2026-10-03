import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { money } from "../../lib/labels";

interface TopCliente {
  customerId: string;
  name: string;
  lifetimeValue: number;
  orderCount: number;
}

interface RotacionItem {
  productId: string;
  name: string;
  qtySold: number;
  revenue: number;
  profitPct: number | null;
}

interface SinMovimientoItem {
  productId: string;
  name: string;
}

interface MonthlyTrendPoint {
  month: string;
  ventas: number;
}

interface ReportData {
  ventas: number;
  ventasDelta: number | null;
  pedidos: number;
  pedidosDelta: number | null;
  ticket: number;
  ticketDelta: number | null;
  margen: number;
  margenDelta: number | null;
  satisfaccion: number | null;
  satisfaccionDelta: number | null;
  comparadoConMes: string;
  clientesNuevos: number;
  clientesRecurrentes: number;
  clientesInactivos: number;
  topClientes: TopCliente[];
  rotacionRevisar: RotacionItem[];
  sinMovimiento: SinMovimientoItem[];
  proyeccionVentas: number;
  monthlyTrend: MonthlyTrendPoint[];
  crecimientoPromedioMensual: number;
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function monthFullLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function monthShortLabel(key: string) {
  const [, m] = key.split("-").map(Number);
  return MONTH_NAMES[m - 1].slice(0, 3);
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-gray-400">—</span>;
  const positive = value >= 0;
  return <span className={`text-xs ${positive ? "text-green-600" : "text-red-600"}`}>{positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%</span>;
}

interface Props {
  storeId?: string;
  onViewBudget: () => void;
}

export default function ReportesTab({ storeId, onViewBudget }: Props) {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    api.get<ReportData>("/finance/reports", { params: { storeId } }).then((r) => setData(r.data));
  }, [storeId]);

  if (!data) return <p className="text-sm text-gray-500">Cargando reportes...</p>;

  const currentMonthKey = data.monthlyTrend[data.monthlyTrend.length - 1]?.month;
  const comparedIsImmediatePrior = (() => {
    if (!currentMonthKey) return true;
    const [y, m] = currentMonthKey.split("-").map(Number);
    const prior = new Date(y, m - 2, 1);
    const priorKey = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, "0")}`;
    return priorKey === data.comparadoConMes;
  })();
  const maxTrend = Math.max(1, ...data.monthlyTrend.map((p) => p.ventas));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Ventas", value: money(data.ventas), delta: data.ventasDelta },
          { label: "Pedidos", value: String(data.pedidos), delta: data.pedidosDelta },
          { label: "Ticket promedio", value: money(data.ticket), delta: data.ticketDelta },
          { label: "Margen", value: `${data.margen.toFixed(1)}%`, delta: data.margenDelta },
          { label: "Satisfacción", value: data.satisfaccion != null ? data.satisfaccion.toFixed(1) : "—", delta: data.satisfaccionDelta },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-3">
            <div className="text-xs uppercase text-gray-500">{c.label}</div>
            <div className="text-lg font-bold">{c.value}</div>
            <Delta value={c.delta} />
          </div>
        ))}
      </div>
      {!comparedIsImmediatePrior && (
        <p className="text-xs text-gray-400">
          Comparado con {monthFullLabel(data.comparadoConMes)}, el último mes con ventas registradas.
        </p>
      )}

      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="font-medium text-sm">Tendencia de ventas (últimos 6 meses)</h3>
          <span className="text-xs text-gray-500">
            Crecimiento promedio mensual:{" "}
            <strong className={data.crecimientoPromedioMensual >= 0 ? "text-green-700" : "text-red-700"}>
              {data.crecimientoPromedioMensual >= 0 ? "+" : ""}{data.crecimientoPromedioMensual.toFixed(1)}%
            </strong>
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              {data.monthlyTrend.map((p) => <th key={p.month} className="py-1 font-normal">{monthShortLabel(p.month)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              {data.monthlyTrend.map((p) => (
                <td key={p.month} className="py-1 align-bottom">
                  <div className="h-16 flex items-end">
                    <div className="w-full bg-pink-500 rounded-t" style={{ height: Math.max(p.ventas > 0 ? 2 : 0, (p.ventas / maxTrend) * 64) }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{money(p.ventas)}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400 pt-2 border-t mt-2">Proyección de ventas próximo mes: <strong className="text-gray-600">{money(data.proyeccionVentas)}</strong></p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
          <h3 className="font-medium mb-2">Clientes este mes</h3>
          <p>Nuevos: <strong>{data.clientesNuevos}</strong></p>
          <p>Recurrentes: <strong>{data.clientesRecurrentes}</strong></p>
          <p className="text-amber-700">Inactivos (&gt;60 días sin pedir): <strong>{data.clientesInactivos}</strong></p>
          <h4 className="font-medium mt-3">Top 5 clientes históricos</h4>
          <ul className="space-y-0.5">
            {data.topClientes.map((c) => (
              <li key={c.customerId} className="flex justify-between">
                <Link to={`/clientes/${c.customerId}`} className="hover:text-pink-700">{c.name}</Link>
                <span className="text-gray-500">{c.orderCount} pedido{c.orderCount === 1 ? "" : "s"} — {money(c.lifetimeValue)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border rounded-lg p-4 text-sm space-y-2">
          <h3 className="font-medium mb-2">Rotación de productos</h3>
          <div>
            <p className="text-gray-500">Candidatos a revisar (baja rentabilidad, mes en curso)</p>
            <ul className="space-y-0.5">
              {data.rotacionRevisar.map((p) => (
                <li key={p.productId} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-amber-700">{p.qtySold} u. — {p.profitPct!.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
            {data.rotacionRevisar.length === 0 && <p className="text-gray-400">Ninguno.</p>}
          </div>
          <div>
            <p className="text-gray-500">Sin movimiento este mes</p>
            <ul>{data.sinMovimiento.map((p) => <li key={p.productId}>{p.name}</li>)}</ul>
            {data.sinMovimiento.length === 0 && <p className="text-gray-400">Ninguno.</p>}
          </div>
          <button type="button" onClick={onViewBudget} className="text-xs text-pink-700 hover:underline pt-1">
            Ver presupuesto detallado
          </button>
        </div>
      </div>
    </div>
  );
}
