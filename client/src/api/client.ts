import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cfloral_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("cfloral_token");
      localStorage.removeItem("cfloral_user");
      localStorage.removeItem("cfloral_permissions");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export type AppRole = "ADMIN" | "GERENTE" | "ADMINISTRATIVO" | "VENDEDOR";

export const PERMISSION_MODULES = [
  "pedidos",
  "taller",
  "finanzas",
  "clientes",
  "clientesSensible",
  "inventario",
  "inventarioCosto",
  "insumos",
  "proveedores",
  "empleados",
  "sedes",
  "horarios",
  "listas",
  "empresa",
  "roles",
  "recomendaciones",
] as const;
export type PermissionKey = (typeof PERMISSION_MODULES)[number];
export type PermissionMatrix = Record<PermissionKey, boolean>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  storeId: string | null;
  storeName: string | null;
  phone?: string | null;
  position?: string | null;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  logo: string | null;
  themeColor: string | null;
  adminId: string | null;
  vendedorId: string | null;
}

export type RecordType = "GASTO" | "COSTO" | "INVERSION" | "OTRO";

export interface Expense {
  id: string;
  storeId: string;
  type: RecordType;
  category: string;
  description: string | null;
  amount: string;
  date: string;
  createdAt: string;
  // Solo viene cuando se consulta sin storeId (vista "Todas las tiendas" de Admin).
  store?: { name: string };
}

export interface FinanceStoreMetrics {
  storeId: string;
  name: string;
  ventas: number;
  costos: number;
  gastos: number;
  inversiones: number;
  ebitda: number;
  ebitdaPct: number;
  ordersCount: number;
}

export interface FinanceSummary {
  ventas: number;
  costos: number;
  gastos: number;
  inversiones: number;
  ebitda: number;
  ebitdaPct: number;
  ordersCount: number;
  // Solo viene cuando se consulta sin storeId (vista "Todas las tiendas" de Admin).
  byStore?: FinanceStoreMetrics[];
}

export interface FinanceEvolutionPoint {
  month: string;
  ventas: number;
  costos: number;
  gastos: number;
  inversiones: number;
  utilidad: number;
}

export interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  storeId: string | null;
  storeName: string | null;
  active: boolean;
  hasSystemAccess: boolean;
  documentId: string | null;
  phone: string | null;
  position: string | null;
  hireDate: string | null;
  contractType: string | null;
  eps: string | null;
  pensionFund: string | null;
  arl: string | null;
  salary: string | null;
  schedule: Record<string, { off?: boolean; start?: string; end?: string }> | null;
  jornadaId: string | null;
  jornadaName: string | null;
  createdAt: string;
}

// Directorio básico de empleados activos (sin datos sensibles), para selects que cualquier
// rol necesita usar: domiciliario en Despachos, empleado en Pagos, admin/vendedor en Sedes.
export interface DirectoryUser {
  id: string;
  name: string;
  position: string | null;
  storeId: string | null;
}

export interface Jornada {
  id: string;
  name: string;
  days: Record<string, boolean>;
  start: string;
  end: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  zone: string | null;
  isDefault: boolean;
}

export interface CustomerSpecialDate {
  id: string;
  label: string;
  month: number;
  day: number;
  notes: string | null;
}

export interface Persona {
  id: string;
  customerId: string;
  name: string;
  relationship: string;
  isTitular: boolean;
  phone: string | null;
  addresses?: CustomerAddress[];
  specialDates?: CustomerSpecialDate[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  type: "INDIVIDUAL" | "CORPORATE";
  documentId: string | null;
  birthDate: string | null;
  acquisitionChannel: string | null;
  tags: string | null;
  lastOrderAt: string | null;
  ordersCount: number;
  lifetimeValue: string;
  paymentMethods: string[];
  emails: string[];
  personas?: Persona[];
  orders?: Order[];
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  taxId: string | null;
  categories: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  rating: number | null;
  active: boolean;
  notes: string | null;
}

export interface Supply {
  id: string;
  storeId: string;
  name: string;
  unit: string;
  costPerUnit: string;
  stock: string;
  supplierId: string | null;
  supplier?: { id: string; name: string } | null;
  active: boolean;
}

export interface ProductRecipeItem {
  id: string;
  supplyId: string;
  quantity: string;
  supply: Supply;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  category: string;
  sku: string | null;
  color: string | null;
  tags: string | null;
  unit: string;
  unitPrice: string;
  costPrice: string | null;
  laborCost: string;
  stock: number;
  lowStockThreshold: number;
  reorderQuantity: number | null;
  shelfLifeDays: number | null;
  receivedAt: string | null;
  groupId: string | null;
  coverPhoto: string | null;
  photos: string[] | null;
  linkedStoreIds?: string[];
  recipe?: ProductRecipeItem[];
}

export interface SupplierInvoiceItem {
  id: string;
  supplyId: string;
  quantity: string;
  unitCost: string;
  supply?: { id: string; name: string };
}

export interface SupplierInvoice {
  id: string;
  storeId: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  invoiceNumber: string;
  date: string;
  total: string;
  items: SupplierInvoiceItem[];
}

export interface BudgetEntry {
  id: string;
  storeId: string;
  month: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface BudgetComparisonRow {
  name: string;
  presupuesto: number;
  real: number;
  cumplimiento: number | null;
  manual: boolean;
}

export interface BudgetComparison {
  currentKey: string;
  priorMonthsCount: number;
  rows: BudgetComparisonRow[];
}

export type PaymentKind = "PROVEEDOR" | "NOMINA" | "CREDITO" | "OTRO";
export type PayeeType = "PROVEEDOR" | "EMPLEADO" | "OTRO";
export type PaymentRecordStatus = "PENDIENTE" | "PAGADO";

export interface Payment {
  id: string;
  storeId: string;
  type: PaymentKind;
  payeeType: PayeeType;
  // Solo viene cuando se consulta sin storeId (vista "Todas las tiendas" de Admin).
  store?: { name: string };
  supplierId: string | null;
  supplier?: { id: string; name: string } | null;
  employeeId: string | null;
  employee?: { id: string; name: string } | null;
  payeeName: string | null;
  amount: string;
  date: string;
  method: string | null;
  status: PaymentRecordStatus;
  notes: string | null;
}

export interface CompanySettings {
  razonSocial?: string | null;
  nit?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  resolution?: string | null;
}

export type OrderStatus = "PENDING" | "IN_PROGRESS" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export const STATUS_FLOW: OrderStatus[] = ["PENDING", "IN_PROGRESS", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En elaboración",
  READY: "Por despachar",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
export const PAY_LABEL: Record<"UNPAID" | "PARTIAL" | "PAID", string> = {
  UNPAID: "Sin pagar",
  PARTIAL: "Pago parcial",
  PAID: "Pagado",
};

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  product: Product;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  storeId: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paymentMethod: string | null;
  occasion: string | null;
  recipientPersonaId: string | null;
  recipientPersona?: Persona | null;
  recipientName: string | null;
  recipientPhone: string | null;
  cardMessage: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryDate: string | null;
  scheduledShift: string | null;
  scheduledHour: string | null;
  deliveryPersonId: string | null;
  deliveryPerson?: { id: string; name: string } | null;
  isThirdPartyDelivery: boolean;
  thirdPartyDriverName: string | null;
  thirdPartyPlate: string | null;
  notes: string | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  notifiedStatus: OrderStatus | null;
  cardPrinted: boolean;
  dispatchPrinted: boolean;
  surveySelected: boolean | null;
  rating: number | null;
  ratingComment: string | null;
  qCalidad: number | null;
  qPuntualidad: number | null;
  qRecomendacion: number | null;
  surveyNotes: string | null;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  store?: Store;
  createdBy?: { id: string; name: string };
  assignedTo?: { id: string; name: string } | null;
}
