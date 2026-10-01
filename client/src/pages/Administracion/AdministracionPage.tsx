import { useEffect, useState } from "react";
import { PermissionKey } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import EmpleadosTab from "./EmpleadosTab";
import EmpresaTab from "./EmpresaTab";
import HorariosTab from "./HorariosTab";
import ListasTab from "./ListasTab";
import RolesTab from "./RolesTab";
import SedesTab from "./SedesTab";

interface TabDef {
  key: PermissionKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: "empleados", label: "Empleados" },
  { key: "sedes", label: "Sedes" },
  { key: "horarios", label: "Horarios" },
  { key: "listas", label: "Listas desplegables" },
  { key: "empresa", label: "Datos de la empresa" },
  { key: "roles", label: "Roles y permisos" },
];

export default function AdministracionPage() {
  const { can } = useAuth();
  const permittedTabs = TABS.filter((t) => can(t.key));
  const [tab, setTab] = useState<PermissionKey | null>(() => permittedTabs[0]?.key ?? null);

  useEffect(() => {
    if (!tab || !permittedTabs.some((t) => t.key === tab)) {
      setTab(permittedTabs[0]?.key ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permittedTabs.map((t) => t.key).join(",")]);

  if (!tab) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Administración</h1>
        <p className="text-sm text-gray-500">No tienes acceso a ningún módulo de administración.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administración</h1>

      <div className="flex gap-1 border-b overflow-x-auto">
        {permittedTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? "border-pink-600 text-pink-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "empleados" && <EmpleadosTab />}
      {tab === "sedes" && <SedesTab />}
      {tab === "horarios" && <HorariosTab />}
      {tab === "listas" && <ListasTab />}
      {tab === "empresa" && <EmpresaTab />}
      {tab === "roles" && <RolesTab />}
    </div>
  );
}
