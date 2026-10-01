import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { defaultPermissions, PERMISSION_MODULES } from "./permissions";

const DEFAULT_LISTS: Record<string, string[]> = {
  paymentMethods: ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia"],
  productCategories: ["Ramos", "Arreglos florales", "Cajas y desayunos", "Plantas", "Globos", "Detalles y accesorios"],
  contractTypes: ["Término indefinido", "Término fijo", "Obra o labor", "Prestación de servicios", "Contrato de aprendizaje"],
  relationships: ["Titular", "Esposo/a", "Hijo/a", "Madre", "Padre", "Hermano/a", "Amigo/a", "Compañero/a de trabajo", "Otro"],
  epsList: ["Sura EPS", "Nueva EPS", "Sanitas EPS", "Compensar EPS", "Famisanar", "Coosalud", "Salud Total"],
  pensionFunds: ["Porvenir", "Colpensiones", "Protección", "Skandia", "Colfondos"],
  arlList: ["Sura ARL", "Positiva ARL", "Colmena ARL", "Seguros Bolívar ARL"],
  expenseCategoriesGasto: [
    "Arriendo", "Servicios públicos", "Nómina administrativa", "Mercadeo y publicidad", "Mantenimiento",
    "Transporte", "Papelería y útiles de oficina", "Seguros", "Honorarios profesionales", "Depreciación",
    "Intereses financieros", "Impuestos", "Otros gastos",
  ],
  expenseCategoriesCosto: ["Materia prima e insumos", "Mano de obra directa", "Empaques y embalajes", "Fletes y transporte de mercancía", "Servicios de producción", "Otros costos"],
  expenseCategoriesInversion: ["Maquinaria y equipo", "Mobiliario y decoración", "Vehículos", "Remodelación de local", "Tecnología y software", "Otras inversiones"],
  expenseCategoriesOtro: ["Otros"],
  insumoUnits: ["tallo", "unidad", "metro", "kilo", "gramo", "litro", "rollo", "paquete", "caja"],
  positions: ["Dueña / Administradora", "Gerente de tienda", "Auxiliar administrativo", "Vendedor/a", "Diseñador/a floral", "Domiciliario"],
  acquisitionChannels: ["Referencia de un cliente", "Peatón (vio la tienda)", "Publicidad", "Evento", "Redes sociales", "Búsqueda en Google/Internet", "Cliente recurrente", "Otro"],
};

const DEFAULT_CARD_MESSAGES: Record<string, string[]> = {
  "Cumpleaños": ["¡Feliz cumpleaños! Que tengas un día tan especial como tú.", "Muchas felicidades en tu día, ¡que se cumplan todos tus deseos!"],
  "Aniversario": ["Feliz aniversario, gracias por tantos momentos felices juntos.", "Por muchos años más a tu lado. ¡Feliz aniversario!"],
  "Condolencias": ["Con nuestro más sentido pésame, te acompañamos en este momento.", "Nuestras condolencias, que encuentres consuelo y paz."],
  "Amor y romance": ["Para la persona que ilumina mis días, te amo.", "Cada flor de este ramo representa un motivo para amarte."],
  "Nuevo bebé": ["¡Bienvenido/a al mundo, pequeño tesoro!", "Felicidades por la llegada de su bebé, que venga lleno de bendiciones."],
  "Agradecimiento": ["Gracias por estar siempre ahí, de corazón.", "Mil gracias por tu apoyo incondicional."],
  "Recuperación / salud": ["Que te mejores pronto, pensando en ti.", "Pronta recuperación, aquí estamos para lo que necesites."],
  "Graduación": ["¡Felicidades, graduado/a! Este es solo el comienzo.", "Tu esfuerzo dio frutos, ¡felicidades por este logro!"],
};

const DEFAULT_JORNADAS = [
  { name: "Turno completo (L-S)", days: { LUN: true, MAR: true, MIE: true, JUE: true, VIE: true, SAB: true, DOM: false }, start: "08:00", end: "18:00" },
  { name: "Medio tiempo mañana (L-V)", days: { LUN: true, MAR: true, MIE: true, JUE: true, VIE: true, SAB: false, DOM: false }, start: "08:00", end: "13:00" },
  { name: "Fin de semana", days: { LUN: false, MAR: false, MIE: false, JUE: false, VIE: false, SAB: true, DOM: true }, start: "09:00", end: "17:00" },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function seedDemoData(prisma: PrismaClient) {
  // ---------- Listas desplegables administrables ----------
  await prisma.listOption.createMany({
    data: Object.entries(DEFAULT_LISTS).flatMap(([listKey, values]) =>
      values.map((value, sortOrder) => ({ listKey, value, sortOrder }))
    ),
  });

  await prisma.cardMessageTemplate.createMany({
    data: Object.entries(DEFAULT_CARD_MESSAGES).flatMap(([occasion, messages]) =>
      messages.map((message, sortOrder) => ({ occasion, message, sortOrder }))
    ),
  });

  const jornadas = await Promise.all(DEFAULT_JORNADAS.map((j) => prisma.jornada.create({ data: j })));

  // ---------- Matriz de roles y permisos ----------
  const defaults = defaultPermissions();
  await prisma.rolePermission.createMany({
    data: (["GERENTE", "ADMINISTRATIVO", "VENDEDOR"] as const).flatMap((role) =>
      PERMISSION_MODULES.map((key) => ({ role, key, allowed: defaults[role][key] }))
    ),
  });

  await prisma.companySettings.create({
    data: {
      id: "singleton",
      razonSocial: "Compañía Floral S.A.S.",
      nit: "900.123.456-7",
      address: "Cra 5 #12-30, Cali, Valle del Cauca",
      phone: "602-555-0100",
      email: "contacto@companiafloral.com",
      resolution: "Resolución DIAN de facturación en trámite.",
      nextInvoiceNumber: 1,
    },
  });

  // ---------- Tiendas ----------
  const storeCentro = await prisma.store.create({
    data: { name: "Floral Centro", address: "Cra 5 #12-30, Cali", phone: "602-555-0110", themeColor: "#EE6795" },
  });
  const storeNorte = await prisma.store.create({
    data: { name: "Floral Norte", address: "Av. 6N #28-10, Cali", phone: "602-555-0120", themeColor: "#5B8DEF" },
  });
  const storeMall = await prisma.store.create({
    data: { name: "Floral Mall", address: "Local 204, Centro Comercial Chipichape, Cali", phone: "602-555-0130", themeColor: "#2FB380" },
  });
  const stores = [storeCentro, storeNorte, storeMall];

  // ---------- Empleados ----------
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      name: "Administradora", email: "admin@cfloral.com", passwordHash, role: "ADMIN",
      documentId: "CC 1001001001", phone: "300-555-0001", position: "Dueña / Administradora",
      hireDate: new Date(2010, 0, 15), contractType: "Término indefinido", eps: "Sura EPS",
      pensionFund: "Porvenir", arl: "Sura ARL", salary: 4500000, jornadaId: jornadas[0].id,
    },
  });

  const employeePasswordHash = await bcrypt.hash("empleada123", 10);
  const managerCentro = await prisma.user.create({
    data: {
      name: "Gerente Floral Centro", email: "centro@cfloral.com", passwordHash: employeePasswordHash, role: "GERENTE",
      storeId: storeCentro.id, documentId: "CC 1002003004", phone: "300-555-0002", position: "Gerente de tienda",
      hireDate: new Date(2015, 2, 1), contractType: "Término indefinido", eps: "Nueva EPS", pensionFund: "Colpensiones",
      arl: "Sura ARL", salary: 2800000, jornadaId: jornadas[0].id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Auxiliar Administrativo", email: "administrativo@cfloral.com", passwordHash: employeePasswordHash, role: "ADMINISTRATIVO",
      storeId: storeCentro.id, documentId: "CC 1003004005", phone: "300-555-0003", position: "Auxiliar administrativo",
      hireDate: new Date(2018, 5, 10), contractType: "Término indefinido", eps: "Sanitas EPS", pensionFund: "Protección",
      arl: "Positiva ARL", salary: 1900000, jornadaId: jornadas[0].id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Vendedora Floral Centro", email: "vendedor@cfloral.com", passwordHash: employeePasswordHash, role: "VENDEDOR",
      storeId: storeCentro.id, documentId: "CC 1004005006", phone: "300-555-0004", position: "Vendedor/a",
      hireDate: new Date(2021, 1, 1), contractType: "Término fijo", eps: "Compensar EPS", pensionFund: "Porvenir",
      arl: "Sura ARL", salary: 1400000, jornadaId: jornadas[0].id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Vendedora Floral Norte", email: "norte@cfloral.com", passwordHash: employeePasswordHash, role: "VENDEDOR",
      storeId: storeNorte.id, documentId: "CC 1005006007", phone: "300-555-0005", position: "Vendedor/a",
      hireDate: new Date(2022, 3, 15), contractType: "Término fijo", eps: "Famisanar", pensionFund: "Skandia",
      arl: "Colmena ARL", salary: 1400000, jornadaId: jornadas[1].id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Camilo Ríos", email: `domiciliario-${Date.now()}@cfloral.local`, passwordHash: employeePasswordHash,
      role: "VENDEDOR", hasSystemAccess: false, storeId: storeCentro.id, documentId: "CC 1006007008",
      phone: "300-555-0006", position: "Domiciliario", hireDate: new Date(2023, 0, 10),
      contractType: "Prestación de servicios", jornadaId: jornadas[0].id,
    },
  });
  const domiciliario = await prisma.user.findFirstOrThrow({ where: { name: "Camilo Ríos" } });

  // ---------- Proveedores ----------
  const supplierFlores = await prisma.supplier.create({
    data: {
      name: "Cultivos La Sabana S.A.S.", contactName: "Jorge Ramírez", phone: "310-555-0101",
      email: "ventas@lasabana.com", address: "Km 3 vía Bogotá", city: "Bogotá", taxId: "NIT 900111222-3",
      categories: "Flores, Follaje", paymentTerms: "30 días", leadTimeDays: 2, rating: 5,
      notes: "Proveedor principal de rosas.",
    },
  });
  const supplierAccesorios = await prisma.supplier.create({
    data: {
      name: "Empaques y Detalles del Valle", contactName: "Luisa Fernanda Cortés", phone: "315-555-0202",
      email: "pedidos@empaquesdelvalle.com", address: "Calle 25 #6-40", city: "Cali", taxId: "NIT 900333444-5",
      categories: "Empaques, Globos, Accesorios", paymentTerms: "Contado", leadTimeDays: 1, rating: 4,
      notes: "Entrega rápida dentro de Cali.",
    },
  });

  // ---------- Insumos por tienda ----------
  const INSUMO_TEMPLATE = [
    { key: "rosa", name: "Rosa roja (tallo)", unit: "tallo", costPerUnit: 2500, stock: 400, supplierId: supplierFlores.id },
    { key: "girasol", name: "Girasol (tallo)", unit: "tallo", costPerUnit: 2200, stock: 150, supplierId: supplierFlores.id },
    { key: "follaje", name: "Follaje / verde", unit: "tallo", costPerUnit: 800, stock: 300, supplierId: supplierFlores.id },
    { key: "papel", name: "Papel de regalo", unit: "metro", costPerUnit: 3500, stock: 60, supplierId: supplierAccesorios.id },
    { key: "cinta", name: "Cinta decorativa", unit: "rollo", costPerUnit: 6000, stock: 25, supplierId: supplierAccesorios.id },
    { key: "globo", name: "Globo metálico", unit: "unidad", costPerUnit: 4500, stock: 80, supplierId: supplierAccesorios.id },
    { key: "florero", name: "Florero / base", unit: "unidad", costPerUnit: 12000, stock: 30, supplierId: supplierAccesorios.id },
  ];

  const insumosByStore: Record<string, Record<string, { id: string; costPerUnit: number }>> = {};
  for (const store of stores) {
    insumosByStore[store.id] = {};
    for (const t of INSUMO_TEMPLATE) {
      const supply = await prisma.supply.create({
        data: {
          storeId: store.id, name: t.name, unit: t.unit, costPerUnit: t.costPerUnit,
          stock: t.stock, supplierId: t.supplierId,
        },
      });
      insumosByStore[store.id][t.key] = { id: supply.id, costPerUnit: t.costPerUnit };
    }
  }

  function recipeCost(recipe: Array<{ key: string; qty: number }>, storeId: string) {
    return recipe.reduce((sum, r) => sum + insumosByStore[storeId][r.key].costPerUnit * r.qty, 0);
  }
  function laborFromRecipe(insumoCost: number) {
    return insumoCost ? Math.round((insumoCost * 0.35) / 500) * 500 : 0;
  }

  // ---------- Productos por tienda (misma receta, costo calculado por tienda) ----------
  const PRODUCT_TEMPLATE: Array<{
    groupId: string; name: string; category: string; unitPrice: number;
    recipe?: Array<{ key: string; qty: number }>; costPrice?: number; stock: number;
  }> = [
    { groupId: "p-rosas12", name: "Ramo de rosas rojas (12)", category: "Ramos", unitPrice: 85000, recipe: [{ key: "rosa", qty: 12 }, { key: "follaje", qty: 4 }, { key: "papel", qty: 1 }], stock: 20 },
    { groupId: "p-girasoles", name: "Arreglo de girasoles", category: "Arreglos florales", unitPrice: 95000, recipe: [{ key: "girasol", qty: 8 }, { key: "follaje", qty: 4 }, { key: "florero", qty: 1 }], stock: 15 },
    { groupId: "p-mixto", name: "Ramo mixto de temporada", category: "Ramos", unitPrice: 70000, recipe: [{ key: "rosa", qty: 6 }, { key: "girasol", qty: 4 }, { key: "follaje", qty: 3 }], stock: 18 },
    { groupId: "p-cajapremium", name: "Caja de rosas premium", category: "Cajas y desayunos", unitPrice: 150000, recipe: [{ key: "rosa", qty: 24 }, { key: "cinta", qty: 1 }], stock: 8 },
    { groupId: "p-suculenta", name: "Planta suculenta", category: "Plantas", unitPrice: 45000, costPrice: 18000, stock: 12 },
    { groupId: "p-globo", name: "Globo metálico", category: "Globos", unitPrice: 15000, recipe: [{ key: "globo", qty: 1 }], stock: 50 },
  ];

  const productsByStoreAndGroup: Record<string, Record<string, string>> = {};
  for (const store of stores) {
    productsByStoreAndGroup[store.id] = {};
    for (const t of PRODUCT_TEMPLATE) {
      const insumoCost = t.recipe ? recipeCost(t.recipe, store.id) : null;
      const laborCost = insumoCost ? laborFromRecipe(insumoCost) : 0;
      const costPrice = insumoCost != null ? insumoCost + laborCost : t.costPrice ?? null;
      const product = await prisma.product.create({
        data: {
          storeId: store.id, groupId: t.groupId, name: t.name, category: t.category,
          unitPrice: t.unitPrice, costPrice: costPrice ?? undefined, laborCost, stock: t.stock,
          recipe: t.recipe ? { create: t.recipe.map((r) => ({ supplyId: insumosByStore[store.id][r.key].id, quantity: r.qty })) } : undefined,
        },
      });
      productsByStoreAndGroup[store.id][t.groupId] = product.id;
    }
  }

  // ---------- Clientes (modelo de personas) ----------
  const customerAna = await prisma.customer.create({
    data: {
      name: "Ana Pérez", phone: "300-111-0001", email: "ana.perez@example.com", type: "INDIVIDUAL",
      acquisitionChannel: "Redes sociales", tags: "frecuente", birthDate: new Date(1990, 3, 12),
      emails: ["ana.perez@example.com"], paymentMethods: ["Tarjeta crédito", "Transferencia"],
      personas: {
        create: {
          name: "Ana Pérez", relationship: "Titular", isTitular: true, phone: "300-111-0001",
          addresses: { create: [{ label: "Casa", address: "Calle 10 #5-20, Cali", city: "Cali", zone: "Sur", isDefault: true }] },
          specialDates: { create: [{ label: "Cumpleaños", month: 4, day: 12 }] },
        },
      },
    },
    include: { personas: true },
  });
  const customerCarlos = await prisma.customer.create({
    data: {
      name: "Carlos Gómez", phone: "300-111-0002", type: "INDIVIDUAL", acquisitionChannel: "Referencia de un cliente",
      personas: {
        create: [
          {
            name: "Carlos Gómez", relationship: "Titular", isTitular: true, phone: "300-111-0002",
            addresses: { create: [{ label: "Casa", address: "Carrera 15 #8-20, Cali", city: "Cali", zone: "Norte", isDefault: true }] },
          },
          {
            name: "Rosa Gómez", relationship: "Madre", isTitular: false, phone: "300-111-0099",
            addresses: { create: [{ label: "Casa de mamá", address: "Carrera 8 #12-45, Cali", city: "Cali", zone: "Oeste", isDefault: true }] },
            specialDates: { create: [{ label: "Cumpleaños de mamá", month: 5, day: 20 }] },
          },
        ],
      },
    },
    include: { personas: true },
  });
  const customerEmpresa = await prisma.customer.create({
    data: {
      name: "María Rodríguez", phone: "300-111-0003", email: "compras@empresa-ejemplo.com", type: "CORPORATE",
      documentId: "NIT 900123456-7", acquisitionChannel: "Búsqueda en Google/Internet", tags: "corporativo,vip",
      personas: {
        create: {
          name: "María Rodríguez", relationship: "Titular", isTitular: true, phone: "300-111-0003",
          addresses: { create: [{ label: "Oficina principal", address: "Av. Colombia #100-1, Piso 4, Cali", city: "Cali", zone: "Oriente", isDefault: true }] },
        },
      },
    },
    include: { personas: true },
  });

  // ---------- Pedidos de ejemplo (varios estados y fechas, para reportes/encuesta) ----------
  let invoiceCounter = 1;
  function nextInvoice() {
    return `CP-${String(invoiceCounter++).padStart(6, "0")}`;
  }

  const orderPlans: Array<{
    store: typeof storeCentro; customer: typeof customerAna; persona: string; productGroupId: string;
    qty: number; status: "PENDING" | "IN_PROGRESS" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID"; daysAgo: number; rating?: number;
  }> = [];
  const customers = [customerAna, customerCarlos, customerEmpresa];
  const statusCycle: Array<"PENDING" | "IN_PROGRESS" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED"> = [
    "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
    "OUT_FOR_DELIVERY", "READY", "IN_PROGRESS", "PENDING", "DELIVERED",
  ];
  for (let i = 0; i < 18; i++) {
    const store = stores[i % stores.length];
    const customer = customers[i % customers.length];
    const persona = customer.personas[0];
    const productGroupId = PRODUCT_TEMPLATE[i % PRODUCT_TEMPLATE.length].groupId;
    const status = statusCycle[i % statusCycle.length];
    orderPlans.push({
      store, customer: customer as never, persona: persona.id, productGroupId,
      qty: 1 + (i % 3), status, paymentStatus: status === "DELIVERED" ? "PAID" : "UNPAID",
      daysAgo: 2 + (17 - i) * 5, rating: status === "DELIVERED" ? 4 + (i % 2) : undefined,
    });
  }

  const deliveredOrderIds: string[] = [];
  for (const plan of orderPlans) {
    const productId = productsByStoreAndGroup[plan.store.id][plan.productGroupId];
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const unitPrice = Number(product.unitPrice);
    const subtotal = unitPrice * plan.qty;
    const createdAt = daysAgo(plan.daysAgo);
    const order = await prisma.order.create({
      data: {
        invoiceNumber: nextInvoice(),
        storeId: plan.store.id,
        customerId: plan.customer.id,
        createdById: managerCentro.id,
        recipientPersonaId: plan.persona,
        status: plan.status,
        paymentStatus: plan.paymentStatus,
        paymentMethod: "Transferencia",
        occasion: "Cumpleaños",
        deliveryAddress: "Calle 10 #5-20, Cali",
        subtotal, total: subtotal, createdAt,
        rating: plan.rating,
        ratingComment: plan.rating ? "Muy buen servicio, flores frescas." : undefined,
        qCalidad: plan.rating, qPuntualidad: plan.rating, qRecomendacion: plan.rating,
        deliveryPersonId: plan.status === "OUT_FOR_DELIVERY" || plan.status === "DELIVERED" ? domiciliario.id : undefined,
        items: { create: [{ productId, productName: product.name, quantity: plan.qty, unitPrice, subtotal }] },
      },
    });
    if (plan.status === "DELIVERED") deliveredOrderIds.push(order.id);
    await prisma.product.update({ where: { id: productId }, data: { stock: { decrement: plan.qty } } });
    await prisma.customer.update({
      where: { id: plan.customer.id },
      data: { lastOrderAt: createdAt, ordersCount: { increment: 1 }, lifetimeValue: { increment: subtotal } },
    });
  }
  await prisma.companySettings.update({ where: { id: "singleton" }, data: { nextInvoiceNumber: invoiceCounter } });

  // Muestreo de encuesta 1-de-5: el primer bloque completo de 5 DELIVERED (en orden de creación) sortea un ganador.
  if (deliveredOrderIds.length >= 5) {
    const group = deliveredOrderIds.slice(0, 5);
    const winnerIdx = Math.floor(Math.random() * 5);
    await Promise.all(group.map((id, idx) => prisma.order.update({ where: { id }, data: { surveySelected: idx === winnerIdx } })));
  }

  // ---------- Facturas/registros financieros (Gasto/Costo/Inversión/Otro) ----------
  const expenseSamples: Array<{ storeId: string; type: "GASTO" | "COSTO" | "INVERSION" | "OTRO"; category: string; description: string; amount: number; daysAgo: number }> = [
    { storeId: storeCentro.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Centro", amount: 1800000, daysAgo: 28 },
    { storeId: storeCentro.id, type: "GASTO", category: "Servicios públicos", description: "Agua, luz e internet", amount: 420000, daysAgo: 20 },
    { storeId: storeCentro.id, type: "GASTO", category: "Nómina administrativa", description: "Nómina quincenal", amount: 2600000, daysAgo: 14 },
    { storeId: storeNorte.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Norte", amount: 1500000, daysAgo: 27 },
    { storeId: storeNorte.id, type: "GASTO", category: "Mercadeo y publicidad", description: "Pauta en redes sociales", amount: 250000, daysAgo: 10 },
    { storeId: storeMall.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Mall", amount: 2100000, daysAgo: 25 },
    { storeId: storeMall.id, type: "GASTO", category: "Depreciación", description: "Depreciación de vitrinas y mobiliario", amount: 180000, daysAgo: 5 },
    { storeId: storeCentro.id, type: "GASTO", category: "Impuestos", description: "ICA municipal", amount: 210000, daysAgo: 3 },
    { storeId: storeCentro.id, type: "COSTO", category: "Otros costos", description: "Compra extra de insumos fuera de factura de proveedor", amount: 150000, daysAgo: 8 },
    { storeId: storeCentro.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Centro", amount: 1800000, daysAgo: 58 },
    { storeId: storeNorte.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Norte", amount: 1500000, daysAgo: 57 },
    { storeId: storeMall.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Mall", amount: 2100000, daysAgo: 55 },
    { storeId: storeCentro.id, type: "COSTO", category: "Otros costos", description: "Compra extra de insumos fuera de factura de proveedor", amount: 120000, daysAgo: 38 },
    { storeId: storeCentro.id, type: "GASTO", category: "Servicios públicos", description: "Agua, luz e internet", amount: 400000, daysAgo: 88 },
    { storeId: storeNorte.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Norte", amount: 1500000, daysAgo: 87 },
    { storeId: storeMall.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Mall", amount: 2100000, daysAgo: 85 },
    { storeId: storeCentro.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Centro", amount: 1800000, daysAgo: 118 },
    { storeId: storeNorte.id, type: "GASTO", category: "Mercadeo y publicidad", description: "Pauta en redes sociales", amount: 220000, daysAgo: 110 },
    { storeId: storeMall.id, type: "GASTO", category: "Arriendo", description: "Arriendo local Floral Mall", amount: 2100000, daysAgo: 115 },
    { storeId: storeCentro.id, type: "INVERSION", category: "Remodelación de local", description: "Remodelación de vitrina y zona de atención", amount: 3500000, daysAgo: 95 },
    { storeId: storeMall.id, type: "INVERSION", category: "Maquinaria y equipo", description: "Nevera exhibidora de flores", amount: 5200000, daysAgo: 60 },
    { storeId: storeNorte.id, type: "INVERSION", category: "Tecnología y software", description: "Equipos de cómputo y licencia de software", amount: 1800000, daysAgo: 30 },
  ];
  for (const e of expenseSamples) {
    await prisma.expense.create({
      data: { storeId: e.storeId, type: e.type, category: e.category, description: e.description, amount: e.amount, date: daysAgo(e.daysAgo), createdById: managerCentro.id },
    });
  }

  // ---------- Presupuestos de ejemplo (mes actual, tienda Centro) ----------
  const monthKey = new Date().toISOString().slice(0, 7);
  const rosas = PRODUCT_TEMPLATE[0];
  const girasoles = PRODUCT_TEMPLATE[1];
  await prisma.budgetEntry.createMany({
    data: [
      { storeId: storeCentro.id, month: monthKey, productName: rosas.name, quantity: 25, unitPrice: rosas.unitPrice, amount: 25 * rosas.unitPrice },
      { storeId: storeCentro.id, month: monthKey, productName: girasoles.name, quantity: 15, unitPrice: girasoles.unitPrice, amount: 15 * girasoles.unitPrice },
    ],
  });

  // ---------- Pagos (liquidación) ----------
  await prisma.payment.createMany({
    data: [
      { storeId: storeCentro.id, type: "PROVEEDOR", payeeType: "PROVEEDOR", supplierId: supplierFlores.id, amount: 1200000, date: daysAgo(15), method: "Transferencia", status: "PAGADO" },
      { storeId: storeCentro.id, type: "NOMINA", payeeType: "EMPLEADO", employeeId: managerCentro.id, amount: 2800000, date: daysAgo(7), method: "Transferencia", status: "PAGADO" },
      { storeId: storeNorte.id, type: "PROVEEDOR", payeeType: "PROVEEDOR", supplierId: supplierAccesorios.id, amount: 450000, date: daysAgo(2), method: "", status: "PENDIENTE" },
    ],
  });

  // ---------- Factura de proveedor recibida (actualiza stock/costo de insumos) ----------
  const centroInsumos = insumosByStore[storeCentro.id];
  await prisma.supplierInvoice.create({
    data: {
      storeId: storeCentro.id, supplierId: supplierFlores.id, invoiceNumber: "FAC-00123", date: daysAgo(6),
      total: 2 * 150 * 2500 /* aproximado */,
      items: { create: [{ supplyId: centroInsumos.rosa.id, quantity: 150, unitCost: 2500 }] },
    },
  });

  return { stores, customers: [customerAna, customerCarlos, customerEmpresa] };
}
