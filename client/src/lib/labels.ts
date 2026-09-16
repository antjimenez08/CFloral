import { ContactChannel, Occasion, OrderStatus, ProductCategory } from "../api/client";

export const occasionLabel: Record<Occasion, string> = {
  BIRTHDAY: "Cumpleaños",
  ANNIVERSARY: "Aniversario",
  SYMPATHY: "Condolencias",
  WEDDING: "Boda",
  GET_WELL: "Recuperación",
  CONGRATULATIONS: "Felicitaciones",
  ROMANCE: "Romance",
  NEW_BABY: "Nuevo bebé",
  GRADUATION: "Graduación",
  CORPORATE: "Corporativo",
  MOTHERS_DAY: "Día de la madre",
  VALENTINES: "San Valentín",
  NO_OCCASION: "Sin ocasión especial",
  OTHER: "Otro",
};

export const channelLabel: Record<ContactChannel, string> = {
  WALK_IN: "En tienda",
  PHONE: "Teléfono",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  WEBSITE: "Sitio web",
  SOCIAL_MEDIA: "Redes sociales",
  MARKETPLACE: "Marketplace",
  REFERRAL: "Referido",
  OTHER: "Otro",
};

export const categoryLabel: Record<ProductCategory, string> = {
  FLOWERS: "Flores",
  GREENERY: "Follaje/verde",
  PLANT: "Planta",
  ARRANGEMENT: "Arreglo",
  CONTAINER: "Florero/contenedor",
  BALLOON: "Globo",
  CARD: "Tarjeta",
  GIFT_ADDON: "Detalle adicional",
  SUPPLY: "Insumo",
  OTHER: "Otro",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  READY_FOR_PICKUP: "Listo para recoger",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const orderStatusColor: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  READY_FOR_PICKUP: "bg-indigo-100 text-indigo-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export const monthLabel = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
