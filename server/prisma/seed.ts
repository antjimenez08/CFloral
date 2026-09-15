import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const storeNames = ["Floral Centro", "Floral Norte", "Floral Mall"];
  const stores = await Promise.all(
    storeNames.map((name) => prisma.store.create({ data: { name } })),
  );

  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
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

  const sampleProducts = [
    { name: "Ramo de rosas rojas (12)", unitPrice: 25, stock: 20 },
    { name: "Arreglo de girasoles", unitPrice: 30, stock: 15 },
    { name: "Ramo mixto de temporada", unitPrice: 22, stock: 18 },
    { name: "Caja de rosas premium", unitPrice: 45, stock: 8 },
    { name: "Globo metálico", unitPrice: 5, stock: 50 },
  ];

  for (const store of stores) {
    for (const p of sampleProducts) {
      await prisma.product.create({
        data: { ...p, storeId: store.id },
      });
    }
  }

  const customers = await Promise.all(
    ["Ana Pérez", "Carlos Gómez", "María Rodríguez"].map((name) =>
      prisma.customer.create({ data: { name, phone: "0000-0000" } }),
    ),
  );

  console.log("Seed completo:");
  console.log("- Tiendas:", stores.map((s) => s.name).join(", "));
  console.log("- Admin: admin@cfloral.com / admin123");
  console.log("- Encargada tienda: centro@cfloral.com / empleada123");
  console.log("- Clientes de ejemplo:", customers.map((c) => c.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
