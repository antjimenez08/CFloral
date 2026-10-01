export type InventarioTab = "productos" | "insumos" | "proveedores";

interface TabDef {
  key: InventarioTab;
  label: string;
}

export default function InventarioTabs({
  active,
  onChange,
  showInsumos,
  showProveedores,
}: {
  active: InventarioTab;
  onChange: (tab: InventarioTab) => void;
  showInsumos: boolean;
  showProveedores: boolean;
}) {
  const tabs: TabDef[] = [
    { key: "productos", label: "Productos" },
    ...(showInsumos ? [{ key: "insumos" as const, label: "Insumos" }] : []),
    ...(showProveedores ? [{ key: "proveedores" as const, label: "Proveedores" }] : []),
  ];

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            active === t.key
              ? "border-pink-600 text-pink-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
