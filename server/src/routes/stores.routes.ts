import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const storesRouter = Router();

storesRouter.use(requireAuth);

storesRouter.get("/", async (req, res) => {
  // Admin ve todas las tiendas; manager/empleado solo la suya.
  const where = req.auth!.role === "ADMIN" ? {} : { id: req.auth!.storeId ?? "" };
  const stores = await prisma.store.findMany({ where, orderBy: { name: "asc" } });
  res.json(stores);
});
