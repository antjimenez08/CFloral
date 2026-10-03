import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { money } from "../../lib/labels";

interface Recommendations {
  queComprar: Array<{ supplyId: string; name: string; stock: string; unit: string; comprar: number }>;
  estrategiasVenta: {
    masVendido: { name: string; qty: number } | null;
    masRentable: { name: string; profitPct: number } | null;
    menosRentable: { name: string; profitPct: number } | null;
    canalTop: { channel: string; count: number } | null;
    clientesInactivos: number;
  };
  accionesFinancieras: { categoriaTop: { category: string; pct: number } | null; productosBajaRentabilidad: number; margenCayo: boolean };
  gestionOperativa: {
    sinDomiciliarios: boolean;
    pedidosSinAsignar: number;
    mejorTienda?: { name: string; ventas: number } | null;
    peorTienda?: { name: string; ventas: number; critico: boolean } | null;
    tiendaMenosSatisfecha?: { name: string; satisfaccion: number } | null;
  };
  resumenPresupuesto: { cumplidos: number; enRiesgo: number; total: number };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="text-sm space-y-1">{children}</div>
    </div>
  );
}

interface Props {
  storeId?: string;
  onViewBudget: () => void;
}

export default function RecomendacionesTab({ storeId, onViewBudget }: Props) {
  const [data, setData] = useState<Recommendations | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Recommendations>("/finance/recommendations", { params: { storeId } })
      .then((r) => setData(r.data))
      .catch(() => setError("No tienes permiso para ver recomendaciones."));
  }, [storeId]);

  if (error) return <p className="text-sm text-gray-500">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Cargando recomendaciones...</p>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel title="Qué comprar">
        {data.queComprar.length === 0 && <p className="text-gray-400">Sin insumos en nivel crítico.</p>}
        {data.queComprar.map((i) => (
          <p key={i.supplyId}>{i.name} — stock {Number(i.stock)} {i.unit}, comprar ≈ <strong>{i.comprar} {i.unit}</strong></p>
        ))}
      </Panel>

      <Panel title="Estrategias de venta">
        {data.estrategiasVenta.masVendido && <p>Más vendido: <strong>{data.estrategiasVenta.masVendido.name}</strong></p>}
        {data.estrategiasVenta.masRentable && <p>Más rentable: <strong>{data.estrategiasVenta.masRentable.name}</strong> ({data.estrategiasVenta.masRentable.profitPct.toFixed(0)}%)</p>}
        {data.estrategiasVenta.menosRentable && <p className="text-amber-700">Revisar: <strong>{data.estrategiasVenta.menosRentable.name}</strong> ({data.estrategiasVenta.menosRentable.profitPct.toFixed(0)}%)</p>}
        {data.estrategiasVenta.canalTop && <p>Canal top de adquisición: <strong>{data.estrategiasVenta.canalTop.channel}</strong> ({data.estrategiasVenta.canalTop.count} clientes)</p>}
        <p>Clientes posiblemente inactivos: <strong>{data.estrategiasVenta.clientesInactivos}</strong></p>
      </Panel>

      <Panel title="Acciones financieras">
        {data.accionesFinancieras.categoriaTop && <p>Mayor gasto: <strong>{data.accionesFinancieras.categoriaTop.category}</strong> ({data.accionesFinancieras.categoriaTop.pct.toFixed(0)}% del total)</p>}
        <p>Productos con rentabilidad &lt;20%: <strong>{data.accionesFinancieras.productosBajaRentabilidad}</strong></p>
        {data.accionesFinancieras.margenCayo && <p className="text-red-700">El margen bruto cayó frente al mes anterior.</p>}
      </Panel>

      <Panel title="Gestión operativa">
        {data.gestionOperativa.sinDomiciliarios && <p className="text-red-700">No hay domiciliarios activos.</p>}
        <p>Pedidos listos/en camino sin asignar: <strong>{data.gestionOperativa.pedidosSinAsignar}</strong></p>
        {data.gestionOperativa.mejorTienda && <p>Mejor tienda del mes: <strong>{data.gestionOperativa.mejorTienda.name}</strong> ({money(data.gestionOperativa.mejorTienda.ventas)})</p>}
        {data.gestionOperativa.peorTienda && (
          <p className={data.gestionOperativa.peorTienda.critico ? "text-red-700" : ""}>
            Tienda más rezagada: <strong>{data.gestionOperativa.peorTienda.name}</strong> ({money(data.gestionOperativa.peorTienda.ventas)})
          </p>
        )}
        {data.gestionOperativa.tiendaMenosSatisfecha && <p>Menor satisfacción: <strong>{data.gestionOperativa.tiendaMenosSatisfecha.name}</strong> ({data.gestionOperativa.tiendaMenosSatisfecha.satisfaccion.toFixed(1)}★)</p>}
      </Panel>

      <Panel title="Resumen del presupuesto">
        <p>Productos cumplidos: <strong className="text-green-700">{data.resumenPresupuesto.cumplidos}</strong> / {data.resumenPresupuesto.total}</p>
        <p>En riesgo (&lt;70%): <strong className="text-red-700">{data.resumenPresupuesto.enRiesgo}</strong></p>
        <button type="button" onClick={onViewBudget} className="text-xs text-pink-700 hover:underline pt-1">
          Ver presupuesto detallado
        </button>
      </Panel>
    </div>
  );
}
