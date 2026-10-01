import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";

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
  clientesNuevos: number;
  clientesRecurrentes: number;
  clientesInactivos: number;
  topClientes: Array<{ customerId: string; name: string; lifetimeValue: number }>;
  rotacionRevisar: Array<{ productId: string; name: string }>;
  sinMovimiento: Array<{ productId: string; name: string }>;
  proyeccionVentas: number;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-gray-400">—</span>;
  const positive = value >= 0;
  return <span className={`text-xs ${positive ? "text-green-600" : "text-red-600"}`}>{positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%</span>;
}

export default function ReportesTab() {
  const { currentStoreId } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<ReportData>("/finance/reports", { params: { storeId: currentStoreId } }).then((r) => setData(r.data));
  }, [currentStoreId]);

  if (!data) return <p className="text-sm text-gray-500">Cargando reportes...</p>;

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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
          <h3 className="font-medium mb-2">Clientes este mes</h3>
          <p>Nuevos: <strong>{data.clientesNuevos}</strong></p>
          <p>Recurrentes: <strong>{data.clientesRecurrentes}</strong></p>
          <p className="text-amber-700">Inactivos (&gt;60 días sin pedir): <strong>{data.clientesInactivos}</strong></p>
          <h4 className="font-medium mt-3">Top 5 clientes históricos</h4>
          <ul className="space-y-0.5">
            {data.topClientes.map((c) => (
              <li key={c.customerId}>
                <Link to={`/clientes/${c.customerId}`} className="hover:text-pink-700">{c.name}</Link> — {money(c.lifetimeValue)}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border rounded-lg p-4 text-sm space-y-2">
          <h3 className="font-medium mb-2">Rotación de productos</h3>
          <div>
            <p className="text-gray-500">Candidatos a revisar (baja rentabilidad)</p>
            <ul>{data.rotacionRevisar.map((p) => <li key={p.productId}>{p.name}</li>)}</ul>
            {data.rotacionRevisar.length === 0 && <p className="text-gray-400">Ninguno.</p>}
          </div>
          <div>
            <p className="text-gray-500">Sin movimiento este mes</p>
            <ul>{data.sinMovimiento.map((p) => <li key={p.productId}>{p.name}</li>)}</ul>
            {data.sinMovimiento.length === 0 && <p className="text-gray-400">Ninguno.</p>}
          </div>
          <p className="pt-2 border-t">Proyección de ventas próximo mes: <strong>{money(data.proyeccionVentas)}</strong></p>
        </div>
      </div>
    </div>
  );
}
