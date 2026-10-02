import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, AppRole, EmployeeUser, Jornada, Store } from "../../api/client";
import { money } from "../../lib/labels";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

type EmployeeSortKey = "name" | "position" | "storeName" | "salary" | "contractType";

const roleLabel: Record<AppRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ADMINISTRATIVO: "Administrativo",
  VENDEDOR: "Vendedor/a",
};

interface ListsForEmployees {
  positions: string[];
  contractTypes: string[];
  epsList: string[];
  pensionFunds: string[];
  arlList: string[];
  [key: string]: string[];
}

const emptyForm = {
  name: "",
  documentId: "",
  phone: "",
  position: "",
  hireDate: "",
  storeId: "",
  contractType: "",
  eps: "",
  pensionFund: "",
  arl: "",
  salary: "",
  jornadaId: "",
  hasSystemAccess: false,
  email: "",
  password: "",
  role: "VENDEDOR" as AppRole,
};

type FormState = typeof emptyForm;

export default function EmpleadosTab() {
  const [users, setUsers] = useState<EmployeeUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [lists, setLists] = useState<ListsForEmployees | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<EmployeeSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: EmployeeSortKey) {
    toggleSort(key, sortKey, sortDir, setSortKey, setSortDir);
  }

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = users;
    if (term) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          (u.position ?? "").toLowerCase().includes(term) ||
          (u.email ?? "").toLowerCase().includes(term)
      );
    }
    if (sortKey) {
      const numeric = sortKey === "salary";
      list = [...list].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = numeric ? Number(av ?? 0) - Number(bv ?? 0) : compareValues(av, bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [users, search, sortKey, sortDir]);

  function load() {
    api.get<EmployeeUser[]>("/users").then((res) => setUsers(res.data));
    api.get<Store[]>("/stores").then((res) => setStores(res.data));
    api.get<Jornada[]>("/jornadas").then((res) => setJornadas(res.data));
    api.get<ListsForEmployees>("/lists").then((res) => setLists(res.data));
  }

  useEffect(load, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, jornadaId: jornadas[0]?.id ?? "" });
    setError("");
    setShowForm(true);
  }

  function startEdit(u: EmployeeUser) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      documentId: u.documentId ?? "",
      phone: u.phone ?? "",
      position: u.position ?? "",
      hireDate: u.hireDate ? u.hireDate.slice(0, 10) : "",
      storeId: u.storeId ?? "",
      contractType: u.contractType ?? "",
      eps: u.eps ?? "",
      pensionFund: u.pensionFund ?? "",
      arl: u.arl ?? "",
      salary: u.salary ?? "",
      jornadaId: u.jornadaId ?? "",
      hasSystemAccess: u.hasSystemAccess,
      email: u.email ?? "",
      password: "",
      role: u.role,
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (form.hasSystemAccess) {
      if (!form.email.trim()) {
        setError("El email es obligatorio para asignar acceso al sistema");
        return;
      }
      if (!editingId && form.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }
      if (form.password && form.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }
    }
    if (form.hasSystemAccess && form.role !== "ADMIN" && !form.storeId) {
      setError("Selecciona la tienda para este rol");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      documentId: form.documentId || undefined,
      phone: form.phone || undefined,
      position: form.position || undefined,
      hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : undefined,
      storeId: form.hasSystemAccess && form.role === "ADMIN" ? undefined : form.storeId || undefined,
      contractType: form.contractType || undefined,
      eps: form.eps || undefined,
      pensionFund: form.pensionFund || undefined,
      arl: form.arl || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      jornadaId: form.jornadaId || undefined,
      hasSystemAccess: form.hasSystemAccess,
    };
    if (form.hasSystemAccess) {
      payload.email = form.email.trim();
      payload.role = form.role;
      if (form.password) payload.password = form.password;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post("/users", payload);
      }
      cancelForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar el empleado");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: EmployeeUser) {
    try {
      await api.put(`/users/${u.id}`, { active: !u.active });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || "No se pudo actualizar el estado");
    }
  }

  function jornadaDisplay(u: EmployeeUser) {
    if (u.jornadaName) return u.jornadaName;
    if (u.schedule) return "Personalizada";
    return "—";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Empleados</h2>
        <button
          onClick={() => (showForm ? cancelForm() : startCreate())}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nuevo empleado"}
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
              <label className="block text-xs font-medium mb-1">Documento</label>
              <input
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.documentId}
                onChange={(e) => setForm({ ...form, documentId: e.target.value })}
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
            <div>
              <label className="block text-xs font-medium mb-1">Cargo</label>
              <input
                list="positions-list"
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
              <datalist id="positions-list">
                {(lists?.positions ?? []).map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fecha de contratación</label>
              <input
                type="date"
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              />
            </div>
            {!(form.hasSystemAccess && form.role === "ADMIN") && (
              <div>
                <label className="block text-xs font-medium mb-1">Tienda</label>
                <select
                  className="border rounded-md px-2 py-1 text-sm w-full"
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
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">Tipo de contrato</label>
              <select
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.contractType}
                onChange={(e) => setForm({ ...form, contractType: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {(lists?.contractTypes ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">EPS</label>
              <select
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.eps}
                onChange={(e) => setForm({ ...form, eps: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {(lists?.epsList ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fondo de pensión</label>
              <select
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.pensionFund}
                onChange={(e) => setForm({ ...form, pensionFund: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {(lists?.pensionFunds ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">ARL</label>
              <select
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.arl}
                onChange={(e) => setForm({ ...form, arl: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {(lists?.arlList ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Salario (COP/mes)</label>
              <input
                type="number"
                min="0"
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Jornada</label>
              <select
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.jornadaId}
                onChange={(e) => setForm({ ...form, jornadaId: e.target.value })}
              >
                <option value="">Sin jornada asignada</option>
                {jornadas.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm pt-1">
            <input
              type="checkbox"
              checked={form.hasSystemAccess}
              onChange={(e) => setForm({ ...form, hasSystemAccess: e.target.checked })}
            />
            Asignar acceso al sistema
          </label>

          {form.hasSystemAccess && (
            <div className="grid grid-cols-2 gap-2 border-t pt-2">
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Rol</label>
                <select
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                >
                  <option value="VENDEDOR">Vendedor/a</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">
                  {editingId ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
                </label>
                <input
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Nota: en este entorno de demostración las contraseñas no se muestran en texto plano en
                  ningún listado; se guardan de forma segura.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 disabled:opacity-50">
            {editingId ? "Guardar cambios" : "Crear empleado"}
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nombre, cargo o email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border rounded-md px-3 py-2 text-sm"
      />

      <div className="bg-white border rounded-lg divide-y overflow-x-auto">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[920px]">
          <span className="flex-1"><SortHeader label="Nombre" sortKey="name" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-36"><SortHeader label="Cargo" sortKey="position" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32"><SortHeader label="Tienda" sortKey="storeName" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-28"><SortHeader label="Salario" sortKey="salary" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-28"><SortHeader label="Contrato" sortKey="contractType" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32">Jornada</span>
          <span className="w-32">Acceso</span>
          <span className="w-24">Estado</span>
          <span className="w-44"></span>
        </div>
        {visibleUsers.map((u) => (
          <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm min-w-[920px]">
            <span className="flex-1">
              {u.name}
              <div className="text-xs text-gray-500">{u.email || "Sin email"}</div>
            </span>
            <span className="w-36 text-gray-500">{u.position ?? "—"}</span>
            <span className="w-32 text-gray-500">{u.storeName ?? "Todas"}</span>
            <span className="w-28 text-gray-500">{u.salary ? money(u.salary) : "—"}</span>
            <span className="w-28 text-gray-500">{u.contractType ?? "—"}</span>
            <span className="w-32 text-gray-500">{jornadaDisplay(u)}</span>
            <span className="w-32">
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  u.hasSystemAccess ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {u.hasSystemAccess ? roleLabel[u.role] : "Sin acceso"}
              </span>
            </span>
            <span className="w-24">
              <span className={`px-2 py-0.5 rounded-full text-xs ${u.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                {u.active ? "Activo" : "Inactivo"}
              </span>
            </span>
            <span className="w-44 flex gap-2">
              <button onClick={() => startEdit(u)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                Editar
              </button>
              <button onClick={() => toggleActive(u)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                {u.active ? "Desactivar" : "Activar"}
              </button>
            </span>
          </div>
        ))}
        {visibleUsers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin empleados registrados.</p>}
      </div>
    </div>
  );
}
