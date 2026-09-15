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
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  storeId: string | null;
  storeName: string | null;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: string;
  stock: number;
  lowStockThreshold: number;
}

export interface OrderItem {
  id: string;
  productId: string;
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
  status: "PENDING" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  deliveryDate: string | null;
  notes: string | null;
  subtotal: string;
  total: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  store?: Store;
  createdBy?: { id: string; name: string };
}
