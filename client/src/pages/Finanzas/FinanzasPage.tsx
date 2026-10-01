import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardTab from "./DashboardTab";
import ReportesTab from "./ReportesTab";
import PresupuestosTab from "./PresupuestosTab";
import RecomendacionesTab from "./RecomendacionesTab";
import FacturasTab from "./FacturasTab";
import PagosTab from "./PagosTab";

type Tab = "dashboard" | "reportes" | "presupuestos" | "recomendaciones" | "facturas" | "pagos";

export default function FinanzasPage() {
  const { can } = useAuth();
  const tabs: Array<[Tab, string]> = [
    ["dashboard", "Dashboard"],
    ["reportes", "Reportes"],
    ["presupuestos", "Presupuestos"],
    ...(can("recomendaciones") ? ([["recomendaciones", "Recomendaciones"]] as Array<[Tab, string]>) : []),
    ["facturas", "Facturas"],
    ["pagos", "Pagos"],
  ];
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Finanzas</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`text-sm rounded-full px-3 py-1.5 ${tab === key ? "bg-pink-600 text-white" : "border hover:bg-pink-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "reportes" && <ReportesTab />}
      {tab === "presupuestos" && <PresupuestosTab />}
      {tab === "recomendaciones" && <RecomendacionesTab />}
      {tab === "facturas" && <FacturasTab />}
      {tab === "pagos" && <PagosTab />}
    </div>
  );
}
