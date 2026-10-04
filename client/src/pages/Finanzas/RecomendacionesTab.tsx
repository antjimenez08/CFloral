import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { money } from "../../lib/labels";

interface Recommendations {
  queComprar: Array<{ supplyId: string; name: string; stock: string; unit: string; comprar: number }>;
  estrategiasVenta: {
    masVendido: { name: string; qtySold: number } | null;
    masRentable: { name: string; profitPct: number } | null;
    menosRentable: { name: string; profitPct: number } | null;
    canalTop: { channel: string; count: number } | null;
    clientesInactivos: number;
  };
  accionesFinancieras: { categoriaTop: { category: string; amount: number; pct: number } | null; productosBajaRentabilidad: number; margenCayo: boolean };
  gestionOperativa: {
    sinDomiciliarios: boolean;
    pedidosSinAsignar: number;
    mejorTienda?: { name: string; ventas: number } | null;
    peorTienda?: { name: string; ventas: number; critico: boolean } | null;
    tiendaMenosSatisfecha?: { name: string; satisfaccion: number } | null;
  };
  resumenPresupuesto: { cumplidos: number; enRiesgo: number; total: number };
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function currentMonthLabel() {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <ul className="text-sm space-y-1.5 list-disc pl-4">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
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

  const queComprar = data.queComprar.length
    ? data.queComprar.map((i) => `${i.name}: quedan ${Number(i.stock)} ${i.unit}, se sugiere comprar ${i.comprar} ${i.unit} más.`)
    : ["Todos los insumos están por encima del nivel mínimo de stock."];

  const estrategias: string[] = [];
  const { masVendido, masRentable, menosRentable, canalTop, clientesInactivos } = data.estrategiasVenta;
  if (masVendido && masVendido.qtySold > 0) {
    estrategias.push(`"${masVendido.name}" es tu producto más vendido: asegura siempre insumos suficientes para él y destácalo en el catálogo y en redes sociales.`);
  }
  if (masRentable && (!masVendido || masRentable.name !== masVendido.name)) {
    estrategias.push(`"${masRentable.name}" tiene la mejor rentabilidad (${masRentable.profitPct.toFixed(0)}%): impúlsalo con combos o descuentos cruzados con productos de menor margen.`);
  }
  if (menosRentable && menosRentable.profitPct < 20) {
    estrategias.push(`"${menosRentable.name}" tiene baja rentabilidad (${menosRentable.profitPct.toFixed(0)}%): revisa su receta de insumos o ajusta su precio de venta.`);
  }
  if (canalTop) {
    estrategias.push(`La mayoría de tus clientes llegan por "${canalTop.channel}": refuerza la inversión en ese canal de adquisición.`);
  }
  if (clientesInactivos > 0) {
    estrategias.push(`${clientesInactivos} cliente(s) están inactivos (sin pedidos recientes): lánzales una promoción de reactivación o un mensaje personalizado.`);
  }
  if (estrategias.length === 0) estrategias.push("Aún no hay suficientes ventas registradas para sugerir estrategias específicas.");

  const accionesFinancieras: string[] = [];
  const { categoriaTop, productosBajaRentabilidad, margenCayo } = data.accionesFinancieras;
  if (categoriaTop) {
    accionesFinancieras.push(`La categoría de gasto más alta este mes es "${categoriaTop.category}" (${money(categoriaTop.amount)}, ${categoriaTop.pct.toFixed(0)}% del total): revisa si puedes negociarla o reducirla.`);
  }
  if (productosBajaRentabilidad > 0) {
    accionesFinancieras.push(`${productosBajaRentabilidad} producto(s) tienen menos del 20% de rentabilidad: renegocia el costo de sus insumos con el proveedor o ajusta su precio de venta.`);
  }
  if (margenCayo) {
    accionesFinancieras.push("El margen bruto bajó respecto al mes anterior: revisa los costos de insumos y considera un ajuste de precios.");
  }
  if (accionesFinancieras.length === 0) accionesFinancieras.push("No se detectan alertas financieras relevantes con los datos actuales.");

  const gestionOperativa: string[] = [];
  const { sinDomiciliarios, pedidosSinAsignar, mejorTienda, peorTienda, tiendaMenosSatisfecha } = data.gestionOperativa;
  if (sinDomiciliarios) {
    gestionOperativa.push(`No hay domiciliarios activos${storeId ? "" : " en una o más tiendas"}: considera asignar o contratar uno para no depender solo de terceros.`);
  }
  if (pedidosSinAsignar > 0) {
    gestionOperativa.push(`${pedidosSinAsignar} pedido(s) listos o en camino aún sin domiciliario asignado: revisa el tablero de Despachos para no retrasar la entrega.`);
  }
  if (mejorTienda) {
    gestionOperativa.push(`"${mejorTienda.name}" lidera en ventas este mes (${money(mejorTienda.ventas)}): identifica qué hace bien (personal, mix de productos, ubicación) y replícalo en las demás tiendas.`);
  }
  if (peorTienda && peorTienda.critico) {
    gestionOperativa.push(`"${peorTienda.name}" vendió menos de la mitad que la tienda líder este mes: revisa su inventario, personal y promociones locales.`);
  }
  if (tiendaMenosSatisfecha) {
    gestionOperativa.push(`"${tiendaMenosSatisfecha.name}" tiene la satisfacción promedio más baja (${tiendaMenosSatisfecha.satisfaccion.toFixed(1)}/5): revisa su proceso de entrega y atención al cliente.`);
  }
  if (gestionOperativa.length === 0) gestionOperativa.push("No se detectan alertas operativas relevantes con los datos actuales.");

  const { cumplidos, enRiesgo, total } = data.resumenPresupuesto;
  const presupuestoResumen = total > 0
    ? `${cumplidos} de ${total} producto(s) cumplen su presupuesto de ${currentMonthLabel()}${enRiesgo ? `; ${enRiesgo} están por debajo del 70%.` : "."}`
    : "Aún no hay suficientes datos para presupuestar.";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Sugerencias generadas a partir de tus datos de ventas, insumos, clientes y gastos, pensadas para apoyar decisiones de compra, ventas y finanzas.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Qué debo comprar" items={queComprar} />
        <Panel title="Estrategias de venta" items={estrategias} />
        <Panel title="Acciones financieras (costos y gastos)" items={accionesFinancieras} />
        <Panel title="Gestión operativa de las tiendas" items={gestionOperativa} />
      </div>
      <div className="bg-white border rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium text-sm">Presupuesto de ventas</h3>
          <p className="text-sm text-gray-500 mt-1">{presupuestoResumen}</p>
        </div>
        <button type="button" onClick={onViewBudget} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5">
          Ver presupuesto detallado
        </button>
      </div>
    </div>
  );
}
