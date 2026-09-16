import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ClienteDetail from "./pages/Clientes/ClienteDetail";
import ClientesList from "./pages/Clientes/ClientesList";
import DashboardLayout from "./pages/DashboardLayout";
import ProductosList from "./pages/Inventario/ProductosList";
import Login from "./pages/Login";
import PedidoDetail from "./pages/Pedidos/PedidoDetail";
import PedidoForm from "./pages/Pedidos/PedidoForm";
import PedidosList from "./pages/Pedidos/PedidosList";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/pedidos" replace />} />
        <Route path="pedidos" element={<PedidosList />} />
        <Route path="pedidos/nuevo" element={<PedidoForm />} />
        <Route path="pedidos/:id" element={<PedidoDetail />} />
        <Route path="clientes" element={<ClientesList />} />
        <Route path="clientes/:id" element={<ClienteDetail />} />
        <Route path="inventario" element={<ProductosList />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
