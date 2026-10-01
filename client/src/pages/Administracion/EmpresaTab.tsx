import { FormEvent, useEffect, useState } from "react";
import { api, CompanySettings } from "../../api/client";

const emptyForm = {
  razonSocial: "",
  nit: "",
  address: "",
  phone: "",
  email: "",
  resolution: "",
};

type FormState = typeof emptyForm;

export default function EmpresaTab() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CompanySettings>("/company").then((res) => {
      const c = res.data ?? {};
      setForm({
        razonSocial: c.razonSocial ?? "",
        nit: c.nit ?? "",
        address: c.address ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        resolution: c.resolution ?? "",
      });
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!form.razonSocial.trim()) {
      setError("La razón social es obligatoria");
      return;
    }
    setSaving(true);
    try {
      await api.put("/company", {
        razonSocial: form.razonSocial.trim(),
        nit: form.nit || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        resolution: form.resolution || undefined,
      });
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar la información de la empresa");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Datos de la empresa</h2>
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 max-w-xl space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">Razón social</label>
          <input
            className="border rounded-md px-2 py-1 text-sm w-full"
            value={form.razonSocial}
            onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">NIT</label>
            <input
              className="border rounded-md px-2 py-1 text-sm w-full"
              value={form.nit}
              onChange={(e) => setForm({ ...form, nit: e.target.value })}
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
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Dirección</label>
          <input
            className="border rounded-md px-2 py-1 text-sm w-full"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
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
          <label className="block text-xs font-medium mb-1">Resolución de facturación (DIAN)</label>
          <textarea
            className="border rounded-md px-2 py-1 text-sm w-full"
            rows={3}
            value={form.resolution}
            onChange={(e) => setForm({ ...form, resolution: e.target.value })}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs text-green-600">Guardado correctamente.</p>}
        <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 disabled:opacity-50">
          Guardar
        </button>
      </form>
    </div>
  );
}
