import cors from "cors";
import "dotenv/config";
import express from "express";
import { authRouter } from "./routes/auth.routes";
import { customersRouter } from "./routes/customers.routes";
import { ordersRouter } from "./routes/orders.routes";
import { productsRouter } from "./routes/products.routes";
import { storesRouter } from "./routes/stores.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/stores", storesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CFloral API escuchando en http://localhost:${PORT}`);
});
