import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/seedDemoData";

const prisma = new PrismaClient();

seedDemoData(prisma)
  .then(({ stores, customers }) => {
    console.log("Seed completo:");
    console.log("- Tiendas:", stores.map((s) => s.name).join(", "));
    console.log("- Admin: admin@cfloral.com / admin123");
    console.log("- Encargada tienda: centro@cfloral.com / empleada123");
    console.log("- Clientes de ejemplo:", customers.map((c) => c.name).join(", "));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
