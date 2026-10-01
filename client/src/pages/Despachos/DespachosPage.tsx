import { useState } from "react";
import SeguimientoTab from "./SeguimientoTab";
import TableroTab from "./TableroTab";

type DespachosTab = "tablero" | "seguimiento";

export default function DespachosPage() {
  const [tab, setTab] = useState<DespachosTab>("tablero");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Despachos</h1>
        <p className="text-sm text-gray-500">
          Gestiona la elaboración, el despacho y la entrega de los pedidos de esta tienda.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("tablero")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "tablero" ? "border-pink-600 text-pink-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Tablero
        </button>
        <button
          onClick={() => setTab("seguimiento")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "seguimiento" ? "border-pink-600 text-pink-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Seguimiento
        </button>
      </div>

      {tab === "tablero" ? <TableroTab /> : <SeguimientoTab />}
    </div>
  );
}
