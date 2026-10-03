import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const paymentKind = z.enum(["PROVEEDOR", "NOMINA", "CREDITO", "OTRO"]);
const payeeType = z.enum(["PROVEEDOR", "EMPLEADO", "OTRO"]);
const paymentStatus = z.enum(["PENDIENTE", "PAGADO"]);

const employeeSelect = { select: { id: true, name: true } } as const;

// Admin sin storeId ve los pagos de todas las tiendas (vista "Todas las tiendas").
paymentsRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }

  const { status, type } = req.query as Record<string, string | undefined>;
  const payments = await prisma.payment.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      employee: employeeSelect,
      ...(storeId ? {} : { store: { select: { name: true } } }),
    },
    orderBy: { date: "desc" },
  });
  res.json(payments);
});

const paymentSchema = z.object({
  storeId: z.string().min(1),
  type: paymentKind,
  payeeType: payeeType,
  supplierId: z.string().optional(),
  employeeId: z.string().optional(),
  payeeName: z.string().optional(),
  amount: z.number().positive(),
  date: z.string().datetime(),
  method: z.string().optional(),
  status: paymentStatus.optional(),
  notes: z.string().optional(),
});

paymentsRouter.post("/", requirePermission("finanzas"), async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, date, status, ...rest } = parsed.data;

  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== storeId) {
    return res.status(403).json({ error: "No puedes registrar pagos para otra tienda" });
  }

  const payment = await prisma.payment.create({
    data: { ...rest, storeId, date: new Date(date), status: status ?? "PENDIENTE" },
    include: { supplier: { select: { id: true, name: true } }, employee: employeeSelect },
  });
  res.status(201).json(payment);
});

const paymentUpdateSchema = paymentSchema.partial();

paymentsRouter.put("/:id", requirePermission("finanzas"), async (req, res) => {
  const parsed = paymentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { date, ...rest } = parsed.data;
  const payment = await prisma.payment.update({
    where: { id: req.params.id },
    data: { ...rest, date: date ? new Date(date) : undefined },
    include: { supplier: { select: { id: true, name: true } }, employee: employeeSelect },
  });
  res.json(payment);
});

paymentsRouter.delete("/:id", requirePermission("finanzas"), async (req, res) => {
  await prisma.payment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
