import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, Supplier, SupplierInvoice, Supply } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

type SupplySortKey = "name" | "unit" | "costPerUnit" | "stock" | "supplierName";

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

interface ListsResponse {
  insumoUnits?: string[];
  [key: string]: string[] | undefined;
}

interface InvoiceRow {
  supplyId: string;
  quantity: string;
  unitCost: string;
}

const emptySupplyForm = { name: "", unit: "unidad", costPerUnit: "", stock: "", supplierId: "" };

export default function InsumosTab() {
  const { currentStoreId, can } = useAuth();
  if (!can("insumos")) {
    return <p className="text-sm text-gray-500">No tienes permiso para ver los insumos.</p>;
  }
  return <InsumosTabInner currentStoreId={currentStoreId} />;
}

function InsumosTabInner({ currentStoreId }: { currentStoreId: string | null }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);

  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null);
  const [supplyForm, setSupplyForm] = useState(emptySupplyForm);
  const [supplyError, setSupplyError] = useState<string | null>(null);
  const [savingSupply, setSavingSupply] = useState(false);

  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceSupplierId, setInvoiceSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceItems, setInvoiceItems] = useState<InvoiceRow[]>([]);
  const [rowSupplyId, setRowSupplyId] = useState("");
  const [rowQty, setRowQty] = useState("");
  const [rowUnitCost, setRowUnitCost] = useState("");
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [supplySearch, setSupplySearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [supplySortKey, setSupplySortKey] = useState<SupplySortKey | null>(null);
  const [supplySortDir, setSupplySortDir] = useState<SortDir>("asc");

  function onSupplySort(key: SupplySortKey) {
    toggleSort(key, supplySortKey, supplySortDir, setSupplySortKey, setSupplySortDir);
  }

  const visibleSupplies = useMemo(() => {
    const term = supplySearch.trim().toLowerCase();
    let list = supplies;
    if (term) list = list.filter((s) => s.name.toLowerCase().includes(term));
    if (supplierFilter) list = list.filter((s) => s.supplierId === supplierFilter);
    if (supplySortKey) {
      const numeric = supplySortKey === "costPerUnit" || supplySortKey === "stock";
      list = [...list].sort((a, b) => {
        const av = supplySortKey === "supplierName" ? a.supplier?.name ?? "" : a[supplySortKey as keyof Supply];
        const bv = supplySortKey === "supplierName" ? b.supplier?.name ?? "" : b[supplySortKey as keyof Supply];
        const cmp = numeric ? Number(av) - Number(bv) : compareValues(av, bv);
        return supplySortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [supplies, supplySearch, supplierFilter, supplySortKey, supplySortDir]);

  async function loadSupplies() {
    if (!currentStoreId) return;
    const res = await api.get<Supply[]>("/supplies", { params: { storeId: currentStoreId } });
    setSupplies(res.data);
  }

  async function loadSuppliers() {
    const res = await api.get<Supplier[]>("/suppliers");
    setSuppliers(res.data);
  }

  async function loadInvoices() {
    if (!currentStoreId) return;
    const res = await api.get<SupplierInvoice[]>("/supplier-invoices", { params: { storeId: currentStoreId } });
    setInvoices(res.data);
  }

  async function loadUnits() {
    try {
      const res = await api.get<ListsResponse>("/lists");
      setUnits(res.data.insumoUnits || []);
    } catch {
      setUnits([]);
    }
  }

  useEffect(() => {
    loadSupplies();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId]);

  useEffect(() => {
    loadSuppliers();
    loadUnits();
  }, []);

  const supplierById = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach((s) => map.set(s.id, s));
    return map;
  }, [suppliers]);

  const supplyById = useMemo(() => {
    const map = new Map<string, Supply>();
    supplies.forEach((s) => map.set(s.id, s));
    return map;
  }, [supplies]);

  function resetSupplyForm() {
    setSupplyForm(emptySupplyForm);
    setEditingSupplyId(null);
    setSupplyError(null);
  }

  function toggleSupplyForm() {
    if (showSupplyForm) {
      resetSupplyForm();
      setShowSupplyForm(false);
    } else {
      resetSupplyForm();
      setShowSupplyForm(true);
    }
  }

  function openEditSupply(s: Supply) {
    setEditingSupplyId(s.id);
    setSupplyForm({
      name: s.name,
      unit: s.unit,
      costPerUnit: String(s.costPerUnit),
      stock: String(s.stock),
      supplierId: s.supplierId || "",
    });
    setSupplyError(null);
    setShowSupplyForm(true);
  }

  async function handleSupplySubmit(e: FormEvent) {
    e.preventDefault();
    setSupplyError(null);
    if (!currentStoreId) return;
    if (!supplyForm.name.trim() || !supplyForm.unit.trim()) {
      setSupplyError("Nombre y unidad son obligatorios");
      return;
    }
    setSavingSupply(true);
    try {
      const payload = {
        storeId: currentStoreId,
        name: supplyForm.name.trim(),
        unit: supplyForm.unit.trim(),
        costPerUnit: Number(supplyForm.costPerUnit) || 0,
        stock: Number(supplyForm.stock) || 0,
        supplierId: supplyForm.supplierId || undefined,
      };
      if (editingSupplyId) {
        await api.put(`/supplies/${editingSupplyId}`, payload);
      } else {
        await api.post("/supplies", payload);
      }
      resetSupplyForm();
      setShowSupplyForm(false);
      loadSupplies();
    } catch (err: any) {
      setSupplyError(err?.response?.data?.error || "No se pudo guardar el insumo");
    } finally {
      setSavingSupply(false);
    }
  }

  const invoiceTotal = useMemo(
    () => invoiceItems.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0),
    [invoiceItems]
  );

  function addInvoiceRow() {
    if (!rowSupplyId || !rowQty || !rowUnitCost || Number(rowQty) <= 0 || Number(rowUnitCost) < 0) return;
    setInvoiceItems((prev) => [...prev, { supplyId: rowSupplyId, quantity: rowQty, unitCost: rowUnitCost }]);
    setRowSupplyId("");
    setRowQty("");
    setRowUnitCost("");
  }

  function removeInvoiceRow(idx: number) {
    setInvoiceItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetInvoiceForm() {
    setInvoiceSupplierId("");
    setInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setInvoiceItems([]);
    setRowSupplyId("");
    setRowQty("");
    setRowUnitCost("");
    setInvoiceError(null);
  }

  async function handleInvoiceSubmit(e: FormEvent) {
    e.preventDefault();
    setInvoiceError(null);
    if (!currentStoreId) return;
    if (!invoiceSupplierId || !invoiceNumber.trim() || invoiceItems.length === 0) {
      setInvoiceError("Selecciona proveedor, número de factura y agrega al menos un insumo");
      return;
    }
    setSavingInvoice(true);
    try {
      await api.post("/supplier-invoices", {
        storeId: currentStoreId,
        supplierId: invoiceSupplierId,
        invoiceNumber: invoiceNumber.trim(),
        date: new Date(invoiceDate).toISOString(),
        items: invoiceItems.map((r) => ({
          supplyId: r.supplyId,
          quantity: Number(r.quantity),
          unitCost: Number(r.unitCost),
        })),
      });
      resetInvoiceForm();
      setShowInvoiceForm(false);
      loadSupplies();
      loadInvoices();
    } catch (err: any) {
      setInvoiceError(err?.response?.data?.error || "No se pudo registrar la factura");
    } finally {
      setSavingInvoice(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Insumos</h2>
          <button onClick={toggleSupplyForm} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
            {showSupplyForm ? "Cancelar" : "Nuevo insumo"}
          </button>
        </div>

        {showSupplyForm && (
          <form onSubmit={handleSupplySubmit} className="bg-white p-4 rounded-lg border space-y-3 max-w-xl">
            {supplyError && <p className="text-sm text-red-600">{supplyError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  required
                  value={supplyForm.name}
                  onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidad</label>
                {units.length > 0 ? (
                  <select
                    value={supplyForm.unit}
                    onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={supplyForm.unit}
                    onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Costo por unidad</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={supplyForm.costPerUnit}
                  onChange={(e) => setSupplyForm({ ...supplyForm, costPerUnit: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={supplyForm.stock}
                  onChange={(e) => setSupplyForm({ ...supplyForm, stock: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor</label>
                <select
                  value={supplyForm.supplierId}
                  onChange={(e) => setSupplyForm({ ...supplyForm, supplierId: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button disabled={savingSupply} type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
              Guardar
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Buscar insumo..."
            value={supplySearch}
            onChange={(e) => setSupplySearch(e.target.value)}
            className="flex-1 min-w-[180px] border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg border divide-y overflow-x-auto">
          <div className="p-3 hidden sm:flex sm:gap-3 text-xs font-semibold text-gray-500 uppercase min-w-[560px]">
            <span className="flex-1"><SortHeader label="Nombre" sortKey="name" active={supplySortKey} dir={supplySortDir} onClick={onSupplySort} /></span>
            <span className="w-24"><SortHeader label="Unidad" sortKey="unit" active={supplySortKey} dir={supplySortDir} onClick={onSupplySort} /></span>
            <span className="w-28 text-right"><SortHeader label="Costo/unidad" sortKey="costPerUnit" active={supplySortKey} dir={supplySortDir} onClick={onSupplySort} className="justify-end" /></span>
            <span className="w-20 text-right"><SortHeader label="Stock" sortKey="stock" active={supplySortKey} dir={supplySortDir} onClick={onSupplySort} className="justify-end" /></span>
            <span className="w-36"><SortHeader label="Proveedor" sortKey="supplierName" active={supplySortKey} dir={supplySortDir} onClick={onSupplySort} /></span>
          </div>
          {visibleSupplies.map((s) => {
            const low = Number(s.stock) <= 20;
            return (
              <div
                key={s.id}
                onClick={() => openEditSupply(s)}
                className="p-3 flex flex-col sm:flex-row sm:items-center sm:gap-3 text-sm gap-1 cursor-pointer hover:bg-pink-50 min-w-[560px]"
              >
                <span className="flex-1">{s.name}</span>
                <span className="w-24 text-gray-500">{s.unit}</span>
                <span className="w-28 sm:text-right">{money(Number(s.costPerUnit))}</span>
                <span className={`w-20 sm:text-right ${low ? "text-red-600 font-semibold" : ""}`}>{s.stock}</span>
                <span className="w-36 text-gray-500">{s.supplier?.name || "—"}</span>
              </div>
            );
          })}
          {visibleSupplies.length === 0 && <p className="p-4 text-sm text-gray-500">Sin insumos en esta tienda.</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Registrar factura de proveedor</h2>
          <button
            onClick={() => {
              if (showInvoiceForm) resetInvoiceForm();
              setShowInvoiceForm((v) => !v);
            }}
            className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
          >
            {showInvoiceForm ? "Cancelar" : "Nueva factura"}
          </button>
        </div>

        {showInvoiceForm && (
          <form onSubmit={handleInvoiceSubmit} className="bg-white p-4 rounded-lg border space-y-3 max-w-2xl">
            {invoiceError && <p className="text-sm text-red-600">{invoiceError}</p>}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor</label>
                <select
                  value={invoiceSupplierId}
                  onChange={(e) => setInvoiceSupplierId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Seleccionar...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número de factura</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <label className="block text-sm font-medium">Insumos recibidos</label>
              <div className="flex gap-2 items-end flex-wrap">
                <select
                  value={rowSupplyId}
                  onChange={(e) => setRowSupplyId(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[160px]"
                >
                  <option value="">Insumo...</option>
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cantidad"
                  value={rowQty}
                  onChange={(e) => setRowQty(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm w-28"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Costo unitario"
                  value={rowUnitCost}
                  onChange={(e) => setRowUnitCost(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm w-32"
                />
                <button type="button" onClick={addInvoiceRow} className="border rounded-md px-3 py-1 text-sm hover:bg-gray-50">
                  Agregar línea
                </button>
              </div>
              {invoiceItems.length > 0 && (
                <div className="divide-y text-sm">
                  {invoiceItems.map((r, idx) => {
                    const supply = supplyById.get(r.supplyId);
                    return (
                      <div key={idx} className="flex items-center justify-between py-1">
                        <span>
                          {supply ? supply.name : r.supplyId} × {r.quantity} @ {money(Number(r.unitCost))}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-500">{money(Number(r.quantity) * Number(r.unitCost))}</span>
                          <button type="button" onClick={() => removeInvoiceRow(idx)} className="text-xs text-red-600">
                            Quitar
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-sm font-medium text-right">Total: {money(invoiceTotal)}</p>
            </div>

            <button disabled={savingInvoice} type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
              Registrar factura
            </button>
          </form>
        )}

        <div className="bg-white rounded-lg border divide-y overflow-x-auto">
          <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[560px]">
            <span className="w-28">Fecha</span>
            <span className="flex-1">Proveedor</span>
            <span className="w-32">N° factura</span>
            <span className="w-16 text-center">Ítems</span>
            <span className="w-28 text-right">Total</span>
          </div>
          {invoices.map((inv) => (
            <div key={inv.id} className="p-3 flex flex-col sm:flex-row sm:items-center text-sm gap-1 sm:gap-0 min-w-[560px]">
              <span className="w-28 text-gray-500">{new Date(inv.date).toLocaleDateString("es-CO")}</span>
              <span className="flex-1">{inv.supplier?.name || supplierById.get(inv.supplierId)?.name || "—"}</span>
              <span className="w-32 text-gray-500">{inv.invoiceNumber}</span>
              <span className="w-16 text-center">{inv.items.length}</span>
              <span className="w-28 sm:text-right font-medium">{money(Number(inv.total))}</span>
            </div>
          ))}
          {invoices.length === 0 && <p className="p-4 text-sm text-gray-500">Sin facturas registradas todavía.</p>}
        </div>
      </div>
    </div>
  );
}
