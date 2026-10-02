import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api, DirectoryUser, Store } from "../../api/client";
import { resizeImageFile } from "../../lib/imageResize";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

type StoreSortKey = "name" | "address" | "phone";

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  logo: "" as string | null,
  themeColor: "#EE6795",
  adminId: "",
  vendedorId: "",
};

type FormState = typeof emptyForm;

export default function SedesTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<StoreSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: StoreSortKey) {
    toggleSort(key, sortKey, sortDir, setSortKey, setSortDir);
  }

  const visibleStores = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = stores;
    if (term) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(term) || (s.address ?? "").toLowerCase().includes(term)
      );
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const cmp = compareValues(a[sortKey], b[sortKey]);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [stores, search, sortKey, sortDir]);

  function load() {
    api.get<Store[]>("/stores").then((res) => setStores(res.data));
    api
      .get<DirectoryUser[]>("/users/directory")
      .then((res) => setUsers(res.data))
      .catch(() => setUsers(null));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function startEdit(s: Store) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      address: s.address ?? "",
      phone: s.phone ?? "",
      logo: s.logo,
      themeColor: s.themeColor ?? "#EE6795",
      adminId: s.adminId ?? "",
      vendedorId: s.vendedorId ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const logo = await resizeImageFile(file, 400, 0.9);
    setForm((f) => ({ ...f, logo }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("El nombre de la sede es obligatorio");
      return;
    }
    const payload = {
      name: form.name.trim(),
      address: form.address || undefined,
      phone: form.phone || undefined,
      logo: form.logo === null ? null : form.logo || undefined,
      themeColor: form.themeColor || undefined,
      adminId: form.adminId || undefined,
      vendedorId: form.vendedorId || undefined,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/stores/${editingId}`, payload);
      } else {
        await api.post("/stores", payload);
      }
      cancelForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar la sede");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Store) {
    try {
      await api.put(`/stores/${s.id}`, { active: !s.active });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || "No se pudo actualizar el estado");
    }
  }

  function employeeName(id: string | null) {
    if (!id) return "—";
    const u = users?.find((u) => u.id === id);
    return u?.name ?? id;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sedes</h2>
        <button
          onClick={() => (showForm ? cancelForm() : startCreate())}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nueva sede"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 max-w-2xl space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Nombre</label>
              <input
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Teléfono</label>
              <input
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Dirección</label>
              <input
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Logo de la sede</label>
              <input type="file" accept="image/*" className="text-sm w-full" onChange={onLogoChange} />
              {form.logo && (
                <div className="flex items-center gap-2 mt-1">
                  <img src={form.logo} alt="Logo" className="h-12 w-12 object-cover rounded-md border" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, logo: null }))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Quitar logo
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Color de tema</label>
              <input
                type="color"
                className="border rounded-md h-8 w-16"
                value={form.themeColor}
                onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Administrador asignado</label>
              {users ? (
                <select
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.adminId}
                  onChange={(e) => setForm({ ...form, adminId: e.target.value })}
                >
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  placeholder="ID del empleado"
                  value={form.adminId}
                  onChange={(e) => setForm({ ...form, adminId: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Vendedor/a asignado</label>
              {users ? (
                <select
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.vendedorId}
                  onChange={(e) => setForm({ ...form, vendedorId: e.target.value })}
                >
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  placeholder="ID del empleado"
                  value={form.vendedorId}
                  onChange={(e) => setForm({ ...form, vendedorId: e.target.value })}
                />
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 disabled:opacity-50">
            {editingId ? "Guardar cambios" : "Crear sede"}
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nombre o dirección..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border rounded-md px-3 py-2 text-sm"
      />

      <div className="bg-white border rounded-lg divide-y overflow-x-auto">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[760px]">
          <span className="flex-1"><SortHeader label="Nombre" sortKey="name" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-44"><SortHeader label="Dirección" sortKey="address" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32"><SortHeader label="Teléfono" sortKey="phone" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32">Admin</span>
          <span className="w-32">Vendedor/a</span>
          <span className="w-24">Estado</span>
          <span className="w-44"></span>
        </div>
        {visibleStores.map((s) => (
          <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm min-w-[760px]">
            <span className="flex-1 flex items-center gap-2">
              {s.logo && <img src={s.logo} alt="" className="h-6 w-6 rounded-full object-cover border" />}
              {s.name}
            </span>
            <span className="w-44 text-gray-500">{s.address ?? "—"}</span>
            <span className="w-32 text-gray-500">{s.phone ?? "—"}</span>
            <span className="w-32 text-gray-500">{employeeName(s.adminId)}</span>
            <span className="w-32 text-gray-500">{employeeName(s.vendedorId)}</span>
            <span className="w-24">
              <span className={`px-2 py-0.5 rounded-full text-xs ${s.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                {s.active ? "Activo" : "Inactivo"}
              </span>
            </span>
            <span className="w-44 flex gap-2">
              <button onClick={() => startEdit(s)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                Editar
              </button>
              <button onClick={() => toggleActive(s)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                {s.active ? "Desactivar" : "Activar"}
              </button>
            </span>
          </div>
        ))}
        {visibleStores.length === 0 && <p className="p-4 text-sm text-gray-500">Sin sedes registradas.</p>}
      </div>
    </div>
  );
}
