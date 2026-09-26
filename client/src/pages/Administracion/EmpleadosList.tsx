import { FormEvent, useEffect, useState } from "react";
import { api, EmployeeUser, Store } from "../../api/client";

const roleLabel: Record<EmployeeUser["role"], string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  EMPLOYEE: "Vendedor/a",
};

export default function EmpleadosList() {
  const [users, setUsers] = useState<EmployeeUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" as EmployeeUser["role"], storeId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<EmployeeUser[]>("/users").then((res) => setUsers(res.data));
    api.get<Store[]>("/stores").then((res) => setStores(res.data));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Nombre, email y una contraseña de al menos 6 caracteres son obligatorios");
      return;
    }
    if (form.role !== "ADMIN" && !form.storeId) {
      setError("Selecciona la tienda para este rol");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", { ...form, storeId: form.role === "ADMIN" ? undefined : form.storeId });
      setForm({ name: "", email: "", password: "", role: "EMPLOYEE", storeId: "" });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: EmployeeUser) {
    await api.put(`/users/${u.id}`, { active: !u.active });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Empleados</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nuevo empleado"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 max-w-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="border rounded-md px-2 py-1 text-sm"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="border rounded-md px-2 py-1 text-sm"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as EmployeeUser["role"] })}
            >
              <option value="EMPLOYEE">Vendedor/a</option>
              <option value="MANAGER">Gerente</option>
              <option value="ADMIN">Administrador</option>
            </select>
            {form.role !== "ADMIN" && (
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              >
                <option value="">Selecciona tienda...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            className="border rounded-md px-2 py-1 text-sm w-full"
            placeholder="Contraseña temporal"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 disabled:opacity-50">
            Crear empleado
          </button>
        </form>
      )}

      <div className="bg-white border rounded-lg divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="flex-1">Nombre</span>
          <span className="w-40">Rol</span>
          <span className="w-40">Tienda</span>
          <span className="w-24">Estado</span>
          <span className="w-28"></span>
        </div>
        {users.map((u) => (
          <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm">
            <span className="flex-1">
              {u.name}
              <div className="text-xs text-gray-500">{u.email}</div>
            </span>
            <span className="w-40">{roleLabel[u.role]}</span>
            <span className="w-40 text-gray-500">{u.storeName ?? "Todas"}</span>
            <span className="w-24">
              <span className={`px-2 py-0.5 rounded-full text-xs ${u.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                {u.active ? "Activo" : "Inactivo"}
              </span>
            </span>
            <span className="w-28">
              <button onClick={() => toggleActive(u)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                {u.active ? "Desactivar" : "Activar"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
