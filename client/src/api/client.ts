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

export type ContactChannel =
  | "WALK_IN"
  | "PHONE"
  | "WHATSAPP"
  | "EMAIL"
  | "WEBSITE"
  | "SOCIAL_MEDIA"
  | "MARKETPLACE"
  | "REFERRAL"
  | "OTHER";

export type Occasion =
  | "BIRTHDAY"
  | "ANNIVERSARY"
  | "SYMPATHY"
  | "WEDDING"
  | "GET_WELL"
  | "CONGRATULATIONS"
  | "ROMANCE"
  | "NEW_BABY"
  | "GRADUATION"
  | "CORPORATE"
  | "MOTHERS_DAY"
  | "VALENTINES"
  | "NO_OCCASION"
  | "OTHER";

export type ProductCategory =
  | "FLOWERS"
  | "GREENERY"
  | "PLANT"
  | "ARRANGEMENT"
  | "CONTAINER"
  | "BALLOON"
  | "CARD"
  | "GIFT_ADDON"
  | "SUPPLY"
  | "OTHER";

export interface CustomerAddress {
  id: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  isDefault: boolean;
}

export interface CustomerSpecialDate {
  id: string;
  label: string;
  occasion: Occasion | null;
  month: number;
  day: number;
  notes: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  type: "INDIVIDUAL" | "CORPORATE";
  documentId: string | null;
  birthDate: string | null;
  preferredContact: ContactChannel | null;
  acquisitionChannel: ContactChannel | null;
  tags: string | null;
  lastOrderAt: string | null;
  ordersCount: number;
  lifetimeValue: string;
  addresses?: CustomerAddress[];
  specialDates?: CustomerSpecialDate[];
  orders?: Order[];
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  sku: string | null;
  color: string | null;
  tags: string | null;
  unit: string;
  unitPrice: string;
  costPrice: string | null;
  stock: number;
  lowStockThreshold: number;
  reorderQuantity: number | null;
  shelfLifeDays: number | null;
  receivedAt: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  product: Product;
}

export type OrderStatus = "PENDING" | "IN_PROGRESS" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export interface Order {
  id: string;
  invoiceNumber: string;
  storeId: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  channel: ContactChannel;
  occasion: Occasion;
  isRush: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientRelationship: string | null;
  cardMessage: string | null;
  deliveryMethod: "PICKUP" | "DELIVERY";
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryDate: string | null;
  deliveryWindow: string | null;
  notes: string | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  store?: Store;
  createdBy?: { id: string; name: string };
  assignedTo?: { id: string; name: string } | null;
}
