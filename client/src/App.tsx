import { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PermissionKey } from "./api/client";
import { useAuth } from "./context/AuthContext";
import AdministracionPage from "./pages/Administracion/AdministracionPage";
import CatalogoPage from "./pages/Catalogo/CatalogoPage";
import ClienteDetail from "./pages/Clientes/ClienteDetail";
import ClientesList from "./pages/Clientes/ClientesList";
import DashboardLayout from "./pages/DashboardLayout";
import DespachosPage from "./pages/Despachos/DespachosPage";
import FinanzasPage from "./pages/Finanzas/FinanzasPage";
import InventarioPage from "./pages/Inventario/InventarioPage";
import Login from "./pages/Login";
import PedidoDetail from "./pages/Pedidos/PedidoDetail";
import PedidoForm from "./pages/Pedidos/PedidoForm";
import PedidosList from "./pages/Pedidos/PedidosList";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
}

function RequirePermission({ permission, children }: { permission: PermissionKey; children: JSX.Element }) {
  const { can } = useAuth();
  if (!can(permission)) return <Navigate to="/catalogo" replace />;
  return children;
}

function RequireAnyPermission({ permissions, children }: { permissions: PermissionKey[]; children: JSX.Element }) {
  const { can } = useAuth();
  if (!permissions.some((p) => can(p))) return <Navigate to="/catalogo" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/catalogo" replace />} />
        <Route path="catalogo" element={<RequirePermission permission="pedidos"><CatalogoPage /></RequirePermission>} />
        <Route path="pedidos" element={<RequirePermission permission="pedidos"><PedidosList /></RequirePermission>} />
        <Route path="pedidos/nuevo" element={<RequirePermission permission="pedidos"><PedidoForm /></RequirePermission>} />
        <Route path="pedidos/:id/editar" element={<RequirePermission permission="pedidos"><PedidoForm /></RequirePermission>} />
        <Route path="pedidos/:id" element={<RequirePermission permission="pedidos"><PedidoDetail /></RequirePermission>} />
        <Route path="clientes" element={<RequirePermission permission="clientes"><ClientesList /></RequirePermission>} />
        <Route path="clientes/:id" element={<RequirePermission permission="clientes"><ClienteDetail /></RequirePermission>} />
        <Route path="inventario" element={<RequirePermission permission="inventario"><InventarioPage /></RequirePermission>} />
        <Route path="despachos" element={<RequirePermission permission="taller"><DespachosPage /></RequirePermission>} />
        <Route path="finanzas" element={<RequirePermission permission="finanzas"><FinanzasPage /></RequirePermission>} />
        <Route
          path="administracion"
          element={
            <RequireAnyPermission permissions={["empleados", "sedes", "horarios", "listas", "empresa", "roles"]}>
              <AdministracionPage />
            </RequireAnyPermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
