import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export async function seedDemoData(prisma: PrismaClient) {
  const storeNames = ["Floral Centro", "Floral Norte", "Floral Mall"];
  const stores = await Promise.all(
    storeNames.map((name) => prisma.store.create({ data: { name } })),
  );

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      name: "Administradora",
      email: "admin@cfloral.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const employeePasswordHash = await bcrypt.hash("empleada123", 10);
  const managerCentro = await prisma.user.create({
    data: {
      name: "Encargada Floral Centro",
      email: "centro@cfloral.com",
      passwordHash: employeePasswordHash,
      role: "MANAGER",
      storeId: stores[0].id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Vendedora Floral Norte",
      email: "norte@cfloral.com",
      passwordHash: employeePasswordHash,
      role: "EMPLOYEE",
      storeId: stores[1].id,
    },
  });

  const today = new Date();

  const sampleProducts = [
    {
      name: "Ramo de rosas rojas (12)", category: "FLOWERS" as const, sku: "RS-ROJ-12", color: "Rojo",
      tags: "amor,romance,aniversario", unitPrice: 25, costPrice: 12, stock: 20,
      reorderQuantity: 10, shelfLifeDays: 7, receivedAt: today,
    },
    {
      name: "Arreglo de girasoles", category: "FLOWERS" as const, sku: "AR-GIR", color: "Amarillo",
      tags: "cumpleaños,alegria", unitPrice: 30, costPrice: 15, stock: 15,
      reorderQuantity: 8, shelfLifeDays: 6, receivedAt: today,
    },
    {
      name: "Ramo mixto de temporada", category: "FLOWERS" as const, sku: "RM-MIX", color: "Multicolor",
      tags: "general", unitPrice: 22, costPrice: 11, stock: 18,
      reorderQuantity: 8, shelfLifeDays: 5, receivedAt: today,
    },
    {
      name: "Caja de rosas premium", category: "ARRANGEMENT" as const, sku: "CJ-ROS-PREM", color: "Rojo",
      tags: "amor,aniversario,premium", unitPrice: 45, costPrice: 22, stock: 8,
      reorderQuantity: 4, shelfLifeDays: 7, receivedAt: today,
    },
    {
      name: "Planta suculenta", category: "PLANT" as const, sku: "PL-SUC", color: "Verde",
      tags: "oficina,regalo,corporativo", unitPrice: 15, costPrice: 6, stock: 12,
      reorderQuantity: 10, shelfLifeDays: undefined, receivedAt: undefined,
    },
    {
      name: "Globo metálico", category: "BALLOON" as const, sku: "GLB-MET", color: "Variado",
      tags: "cumpleaños,fiesta", unitPrice: 5, costPrice: 2, stock: 50,
      reorderQuantity: 20, shelfLifeDays: undefined, receivedAt: undefined,
    },
    {
      name: "Tarjeta de dedicatoria", category: "CARD" as const, sku: "TJ-DED", color: undefined,
      tags: "mensaje", unitPrice: 2, costPrice: 0.5, stock: 100,
      reorderQuantity: 30, shelfLifeDays: undefined, receivedAt: undefined,
    },
  ];

  for (const store of stores) {
    for (const p of sampleProducts) {
      await prisma.product.create({ data: { ...p, storeId: store.id } });
    }
  }

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Ana Pérez",
        phone: "0000-0000",
        email: "ana.perez@example.com",
        type: "INDIVIDUAL",
        preferredContact: "WHATSAPP",
        acquisitionChannel: "SOCIAL_MEDIA",
        tags: "frecuente",
        birthDate: new Date(1990, 3, 12),
        addresses: {
          create: [{ label: "Casa", address: "Calle 10 #5-20", city: "Cali", isDefault: true }],
        },
        specialDates: {
          create: [
            { label: "Cumpleaños de Ana", occasion: "BIRTHDAY", month: 4, day: 12 },
            { label: "Aniversario de bodas", occasion: "ANNIVERSARY", month: 9, day: 3 },
          ],
        },
      },
    }),
    prisma.customer.create({
      data: {
        name: "Carlos Gómez",
        phone: "0000-0001",
        type: "INDIVIDUAL",
        preferredContact: "PHONE",
        acquisitionChannel: "REFERRAL",
        addresses: {
          create: [
            {
              label: "Casa de mamá",
              recipientName: "Rosa Gómez",
              phone: "0000-0099",
              address: "Carrera 8 #12-45",
              city: "Cali",
              isDefault: true,
            },
          ],
        },
        specialDates: {
          create: [{ label: "Cumpleaños de mamá", occasion: "BIRTHDAY", month: 5, day: 20 }],
        },
      },
    }),
    prisma.customer.create({
      data: {
        name: "María Rodríguez",
        phone: "0000-0002",
        email: "compras@empresa-ejemplo.com",
        type: "CORPORATE",
        documentId: "NIT 900123456-7",
        preferredContact: "EMAIL",
        acquisitionChannel: "WEBSITE",
        tags: "corporativo,vip",
        addresses: {
          create: [{ label: "Oficina principal", address: "Av. Colombia #100-1, Piso 4", city: "Cali", isDefault: true }],
        },
      },
    }),
  ]);

  const expenseSamples: Array<{ type: "COST" | "EXPENSE" | "INVESTMENT"; category: string; description: string; amount: number; daysAgo: number }> = [
    { type: "EXPENSE", category: "Arriendo", description: "Arriendo local Floral Centro", amount: 1800000, daysAgo: 5 },
    { type: "EXPENSE", category: "Servicios públicos", description: "Agua, luz e internet", amount: 420000, daysAgo: 4 },
    { type: "EXPENSE", category: "Nómina administrativa", description: "Nómina quincenal", amount: 2600000, daysAgo: 3 },
    { type: "COST", category: "Otros costos", description: "Compra extra de insumos fuera de factura de proveedor", amount: 150000, daysAgo: 2 },
    { type: "INVESTMENT", category: "Tecnología y software", description: "Equipo de cómputo y licencia de software", amount: 1800000, daysAgo: 10 },
  ];
  for (const e of expenseSamples) {
    const date = new Date(today);
    date.setDate(date.getDate() - e.daysAgo);
    await prisma.expense.create({
      data: {
        storeId: stores[0].id,
        type: e.type,
        category: e.category,
        description: e.description,
        amount: e.amount,
        date,
        createdById: managerCentro.id,
      },
    });
  }

  return { stores, customers };
}
