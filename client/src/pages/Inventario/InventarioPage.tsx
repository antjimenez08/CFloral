import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import InsumosTab from "./InsumosTab";
import InventarioTabs, { InventarioTab } from "./InventarioTabs";
import ProductosTab from "./ProductosTab";
import ProveedoresTab from "./ProveedoresTab";

export default function InventarioPage() {
  const { can } = useAuth();
  const showInsumos = can("insumos");
  const showProveedores = can("proveedores");
  const [tab, setTab] = useState<InventarioTab>("productos");

  const activeTab = tab === "insumos" && !showInsumos ? "productos" : tab === "proveedores" && !showProveedores ? "productos" : tab;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventario</h1>
      <InventarioTabs active={activeTab} onChange={setTab} showInsumos={showInsumos} showProveedores={showProveedores} />
      {activeTab === "productos" && <ProductosTab />}
      {activeTab === "insumos" && <InsumosTab />}
      {activeTab === "proveedores" && <ProveedoresTab />}
    </div>
  );
}
