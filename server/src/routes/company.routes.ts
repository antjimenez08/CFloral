import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const companyRouter = Router();

companyRouter.use(requireAuth);

// Administración → Datos de la empresa: registro único compartido (singleton).
companyRouter.get("/", async (_req, res) => {
  const company = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
  // "No hay datos de empresa aún" es un estado válido: se devuelve objeto vacío, no 404.
  res.json(company ?? {});
});

const companySchema = z.object({
  razonSocial: z.string().min(1, "La razón social es obligatoria"),
  nit: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  resolution: z.string().optional(),
});

companyRouter.put("/", requirePermission("empresa"), async (req, res) => {
  const parsed = companySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  // `nextInvoiceNumber` nunca se acepta desde el cliente: se excluye explícitamente
  // quedándonos solo con los campos de companySchema.
  const data = parsed.data;
  const company = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  res.json(company);
});
