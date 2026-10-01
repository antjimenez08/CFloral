import { useEffect, useState } from "react";
import { api, AppRole, PERMISSION_MODULES, PermissionKey, PermissionMatrix } from "../../api/client";

const MODULE_LABELS: Record<PermissionKey, string> = {
  pedidos: "Pedidos (y Catálogo)",
  taller: "Despachos",
  finanzas: "Finanzas (dashboard, facturas y pagos)",
  clientes: "Clientes",
  clientesSensible: "Clientes — documento y valor histórico",
  inventario: "Inventario — Productos",
  inventarioCosto: "Inventario — costo y margen",
  insumos: "Inventario — Insumos",
  proveedores: "Proveedores",
  empleados: "Administración — Empleados",
  sedes: "Administración — Sedes",
  horarios: "Administración — Horarios",
  listas: "Administración — Listas desplegables",
  empresa: "Administración — Datos de la empresa",
  roles: "Administración — Roles y permisos",
  recomendaciones: "Recomendaciones (perfil gerencial)",
};

const EDITABLE_ROLES: AppRole[] = ["GERENTE", "ADMINISTRATIVO", "VENDEDOR"];

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ADMINISTRATIVO: "Administrativo",
  VENDEDOR: "Vendedor/a",
};

type PermissionsResponse = Record<AppRole, PermissionMatrix>;

export default function RolesTab() {
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<PermissionsResponse>("/permissions").then((res) => setPermissions(res.data));
  }, []);

  async function toggle(role: AppRole, key: PermissionKey, allowed: boolean) {
    if (!permissions) return;
    setError("");
    const prev = permissions;
    setPermissions({
      ...permissions,
      [role]: { ...permissions[role], [key]: allowed },
    });
    try {
      await api.put("/permissions", { role, key, allowed });
    } catch (err: any) {
      setPermissions(prev);
      setError(err?.response?.data?.error || "No se pudo actualizar el permiso");
    }
  }

  if (!permissions) {
    return <p className="text-sm text-gray-500">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Roles y permisos</h2>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold text-gray-500 uppercase border-b">
              <th className="text-left p-3">Módulo</th>
              <th className="p-3 w-28">Administrador</th>
              {EDITABLE_ROLES.map((role) => (
                <th key={role} className="p-3 w-28">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((key) => (
              <tr key={key} className="border-b last:border-b-0">
                <td className="p-3">{MODULE_LABELS[key]}</td>
                <td className="p-3 text-center">
                  <input type="checkbox" checked disabled />
                </td>
                {EDITABLE_ROLES.map((role) => (
                  <td key={role} className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!permissions[role]?.[key]}
                      onChange={(e) => toggle(role, key, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
