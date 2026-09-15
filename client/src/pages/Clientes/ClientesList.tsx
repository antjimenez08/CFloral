import { FormEvent, useEffect, useState } from "react";
import { api, Customer } from "../../api/client";

export default function ClientesList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Customer[]>("/customers", { params: search ? { search } : undefined });
    setCustomers(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/customers", { name, phone });
      setName("");
      setPhone("");
      setShowForm(false);
      load();
    } catch {
      setError("No se pudo crear el cliente");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border space-y-3 max-w-md">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nombre o teléfono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border rounded-md px-3 py-2"
      />

      <div className="bg-white rounded-lg border divide-y">
        {customers.map((c) => (
          <div key={c.id} className="p-3 flex justify-between text-sm">
            <span className="font-medium">{c.name}</span>
            <span className="text-gray-500">{c.phone}</span>
          </div>
        ))}
        {customers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin clientes todavía.</p>}
      </div>
    </div>
  );
}
