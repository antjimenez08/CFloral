import cors from "cors";
import "dotenv/config";
import express from "express";
import path from "path";
import { seedDemoData } from "./lib/seedDemoData";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth.routes";
import { customersRouter } from "./routes/customers.routes";
import { expensesRouter } from "./routes/expenses.routes";
import { financeRouter } from "./routes/finance.routes";
import { ordersRouter } from "./routes/orders.routes";
import { productsRouter } from "./routes/products.routes";
import { storesRouter } from "./routes/stores.routes";
import { usersRouter } from "./routes/users.routes";
import { suppliersRouter } from "./routes/suppliers.routes";
import { suppliesRouter } from "./routes/supplies.routes";
import { supplierInvoicesRouter } from "./routes/supplierInvoices.routes";
import { jornadasRouter } from "./routes/jornadas.routes";
import { listsRouter } from "./routes/lists.routes";
import { companyRouter } from "./routes/company.routes";
import { permissionsRouter } from "./routes/permissions.routes";
import { budgetsRouter } from "./routes/budgets.routes";
import { paymentsRouter } from "./routes/payments.routes";

const app = express();
app.use(cors());
// Límite alto porque fotos de producto y logos de tienda viajan como base64 en el body.
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/stores", storesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/users", usersRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/finance", financeRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/supplies", suppliesRouter);
app.use("/api/supplier-invoices", supplierInvoicesRouter);
app.use("/api/jornadas", jornadasRouter);
app.use("/api/lists", listsRouter);
app.use("/api/company", companyRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/payments", paymentsRouter);

// Sirve la web (client/dist) desde el mismo servicio para simplificar el despliegue.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

async function seedIfEmpty() {
  const storeCount = await prisma.store.count();
  if (storeCount === 0) {
    console.log("Base de datos vacía: creando tiendas y datos de ejemplo...");
    await seedDemoData(prisma);
    console.log("Listo. Usuario admin: admin@cfloral.com / admin123");
  }
}

const PORT = process.env.PORT || 4000;

seedIfEmpty()
  .catch((err) => console.error("No se pudo crear datos de ejemplo:", err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`CFloral escuchando en http://localhost:${PORT}`);
    });
  });
