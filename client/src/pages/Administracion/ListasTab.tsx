import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";

interface ListsData {
  paymentMethods: string[];
  productCategories: string[];
  contractTypes: string[];
  relationships: string[];
  epsList: string[];
  pensionFunds: string[];
  arlList: string[];
  expenseCategoriesGasto: string[];
  expenseCategoriesCosto: string[];
  expenseCategoriesInversion: string[];
  expenseCategoriesOtro: string[];
  insumoUnits: string[];
  positions: string[];
  acquisitionChannels: string[];
  occasions: string[];
  [key: string]: string[];
}

interface CardMessage {
  id: string;
  occasion: string;
  message: string;
  sortOrder: number;
}

const LIST_LABELS: Record<string, string> = {
  paymentMethods: "Formas de pago",
  productCategories: "Categorías de producto",
  contractTypes: "Tipos de contrato",
  relationships: "Relaciones (personas)",
  epsList: "EPS",
  pensionFunds: "Fondos de pensión",
  arlList: "ARL",
  expenseCategoriesGasto: "Categorías de Gasto",
  expenseCategoriesCosto: "Categorías de Costo",
  expenseCategoriesInversion: "Categorías de Inversión",
  expenseCategoriesOtro: "Categorías de Otro",
  insumoUnits: "Unidades de insumo",
  positions: "Cargos",
  acquisitionChannels: "Canales de adquisición",
};

const LIST_KEYS = Object.keys(LIST_LABELS);

export default function ListasTab() {
  const [lists, setLists] = useState<ListsData | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>(LIST_KEYS[0]);
  const [newValue, setNewValue] = useState("");
  const [listError, setListError] = useState("");

  const [cardMessages, setCardMessages] = useState<Record<string, CardMessage[]>>({});
  const [occasionInput, setOccasionInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [cardError, setCardError] = useState("");

  function loadLists() {
    return api.get<ListsData>("/lists").then((res) => {
      setLists(res.data);
      return res.data;
    });
  }

  function loadCardMessages(occasions: string[]) {
    occasions.forEach((occasion) => {
      api
        .get<CardMessage[]>("/lists/card-messages", { params: { occasion } })
        .then((res) => setCardMessages((prev) => ({ ...prev, [occasion]: res.data })));
    });
  }

  useEffect(() => {
    loadLists().then((data) => loadCardMessages(data.occasions ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addValue(e: FormEvent) {
    e.preventDefault();
    setListError("");
    if (!newValue.trim()) return;
    try {
      await api.post(`/lists/${selectedKey}`, { value: newValue.trim() });
      setNewValue("");
      loadLists();
    } catch (err: any) {
      setListError(err?.response?.data?.error || "No se pudo agregar el valor");
    }
  }

  async function removeValue(value: string) {
    try {
      await api.delete(`/lists/${selectedKey}/${encodeURIComponent(value)}`);
      loadLists();
    } catch (err: any) {
      setListError(err?.response?.data?.error || "No se pudo quitar el valor");
    }
  }

  async function addCardMessage(e: FormEvent) {
    e.preventDefault();
    setCardError("");
    if (!occasionInput.trim() || !messageInput.trim()) {
      setCardError("Completa la ocasión y el mensaje");
      return;
    }
    try {
      await api.post("/lists/card-messages", { occasion: occasionInput.trim(), message: messageInput.trim() });
      setMessageInput("");
      const occasion = occasionInput.trim();
      setOccasionInput("");
      const data = await loadLists();
      loadCardMessages(data.occasions ?? [occasion]);
    } catch (err: any) {
      setCardError(err?.response?.data?.error || "No se pudo agregar el mensaje");
    }
  }

  async function removeCardMessage(id: string) {
    try {
      await api.delete(`/lists/card-messages/${id}`);
      const data = await loadLists();
      loadCardMessages(data.occasions ?? []);
    } catch (err: any) {
      setCardError(err?.response?.data?.error || "No se pudo quitar el mensaje");
    }
  }

  const values = (lists?.[selectedKey] ?? []).slice().sort((a, b) => a.localeCompare(b, "es"));
  const occasions = lists?.occasions ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Listas desplegables</h2>
        <select
          className="border rounded-md px-2 py-1 text-sm"
          value={selectedKey}
          onChange={(e) => {
            setSelectedKey(e.target.value);
            setListError("");
          }}
        >
          {LIST_KEYS.map((k) => (
            <option key={k} value={k}>
              {LIST_LABELS[k]}
            </option>
          ))}
        </select>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 bg-pink-50 text-pink-800 text-xs px-2 py-1 rounded-full">
                {v}
                <button onClick={() => removeValue(v)} className="text-pink-600 hover:text-pink-900 font-bold">
                  ×
                </button>
              </span>
            ))}
            {values.length === 0 && <p className="text-sm text-gray-500">Sin valores todavía.</p>}
          </div>

          <form onSubmit={addValue} className="flex gap-2">
            <input
              className="border rounded-md px-2 py-1 text-sm flex-1"
              placeholder="Agregar valor..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <button className="bg-pink-600 text-white text-sm rounded-md px-3 py-1">Agregar</button>
          </form>
          {listError && <p className="text-xs text-red-600">{listError}</p>}
          <p className="text-xs text-gray-400">Quitar un valor no cambia los registros que ya lo usaban.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Ocasiones y mensajes de tarjeta</h2>
        <div className="bg-white border rounded-lg p-4 space-y-4">
          {occasions.map((occasion) => (
            <div key={occasion} className="border-b last:border-b-0 pb-3 last:pb-0">
              <h3 className="text-sm font-semibold mb-1">{occasion}</h3>
              <ul className="space-y-1">
                {(cardMessages[occasion] ?? []).map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 text-sm bg-gray-50 rounded px-2 py-1">
                    <span>{m.message}</span>
                    <button onClick={() => removeCardMessage(m.id)} className="text-red-600 text-xs hover:underline shrink-0">
                      Quitar
                    </button>
                  </li>
                ))}
                {(cardMessages[occasion] ?? []).length === 0 && (
                  <li className="text-xs text-gray-400">Sin mensajes todavía.</li>
                )}
              </ul>
            </div>
          ))}
          {occasions.length === 0 && <p className="text-sm text-gray-500">Sin ocasiones registradas.</p>}

          <form onSubmit={addCardMessage} className="space-y-2 border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                list="occasions-list"
                className="border rounded-md px-2 py-1 text-sm w-full"
                placeholder="Ocasión (nueva o existente)"
                value={occasionInput}
                onChange={(e) => setOccasionInput(e.target.value)}
              />
              <datalist id="occasions-list">
                {occasions.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <textarea
              className="border rounded-md px-2 py-1 text-sm w-full"
              placeholder="Mensaje sugerido para la tarjeta"
              rows={2}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            />
            {cardError && <p className="text-xs text-red-600">{cardError}</p>}
            <button className="bg-pink-600 text-white text-sm rounded-md px-3 py-1">Agregar mensaje</button>
          </form>
        </div>
      </div>
    </div>
  );
}
