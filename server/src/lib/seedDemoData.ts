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
  await prisma.user.create({
    data: {
      name: "Encargada Floral Centro",
      email: "centro@cfloral.com",
      passwordHash: employeePasswordHash,
      role: "MANAGER",
      storeId: stores[0].id,
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

  return { stores, customers };
}
