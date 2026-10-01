import { FormEvent, useEffect, useState } from "react";
import { api, Jornada } from "../../api/client";

const DAYS: { key: string; label: string }[] = [
  { key: "LUN", label: "Lun" },
  { key: "MAR", label: "Mar" },
  { key: "MIE", label: "Mié" },
  { key: "JUE", label: "Jue" },
  { key: "VIE", label: "Vie" },
  { key: "SAB", label: "Sáb" },
  { key: "DOM", label: "Dom" },
];

const emptyDays: Record<string, boolean> = {
  LUN: true,
  MAR: true,
  MIE: true,
  JUE: true,
  VIE: true,
  SAB: false,
  DOM: false,
};

const emptyForm = {
  name: "",
  days: { ...emptyDays },
  start: "08:00",
  end: "18:00",
};

type FormState = typeof emptyForm;

export default function HorariosTab() {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<Jornada[]>("/jornadas").then((res) => setJornadas(res.data));
  }

  useEffect(load, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, days: { ...emptyDays } });
    setError("");
    setShowForm(true);
  }

  function startEdit(j: Jornada) {
    setEditingId(j.id);
    setForm({
      name: j.name,
      days: { ...emptyDays, ...j.days },
      start: j.start,
      end: j.end,
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
      setError("El nombre de la jornada es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), days: form.days, start: form.start, end: form.end };
      if (editingId) {
        await api.put(`/jornadas/${editingId}`, payload);
      } else {
        await api.post("/jornadas", payload);
      }
      cancelForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar la jornada");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(j: Jornada) {
    if (!confirm(`¿Eliminar la jornada "${j.name}"?`)) return;
    try {
      await api.delete(`/jornadas/${j.id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || "No se pudo eliminar la jornada");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jornadas</h2>
          <button
            onClick={() => (showForm ? cancelForm() : startCreate())}
            className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
          >
            {showForm ? "Cancelar" : "Nueva jornada"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 max-w-xl space-y-3 mt-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nombre</label>
              <input
                className="border rounded-md px-2 py-1 text-sm w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Días</label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d.key} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.days[d.key]}
                      onChange={(e) => setForm({ ...form, days: { ...form.days, [d.key]: e.target.checked } })}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Hora de inicio</label>
                <input
                  type="time"
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hora de fin</label>
                <input
                  type="time"
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 disabled:opacity-50">
              {editingId ? "Guardar cambios" : "Crear jornada"}
            </button>
          </form>
        )}

        <div className="bg-white border rounded-lg divide-y mt-3">
          <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
            <span className="flex-1">Nombre</span>
            <span className="w-56">Días</span>
            <span className="w-32">Horario</span>
            <span className="w-32"></span>
          </div>
          {jornadas.map((j) => (
            <div key={j.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm">
              <span className="flex-1">{j.name}</span>
              <span className="w-56 text-gray-500">
                {DAYS.filter((d) => j.days?.[d.key]).map((d) => d.label).join(", ") || "—"}
              </span>
              <span className="w-32 text-gray-500">
                {j.start} – {j.end}
              </span>
              <span className="w-32 flex gap-2">
                <button onClick={() => startEdit(j)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                  Editar
                </button>
                <button onClick={() => handleDelete(j)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50 text-red-600">
                  Eliminar
                </button>
              </span>
            </div>
          ))}
          {jornadas.length === 0 && <p className="p-4 text-sm text-gray-500">Sin jornadas registradas.</p>}
        </div>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
        Los horarios personalizados por empleado (por fuera de una jornada con nombre) se asignan desde el
        selector de "Jornada" en el formulario de cada empleado, en la pestaña Empleados.
      </p>
    </div>
  );
}
