import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

const expenseType = z.enum(["COST", "EXPENSE", "INVESTMENT"]);

expensesRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const { from, to, type } = req.query as Record<string, string | undefined>;
  const expenses = await prisma.expense.findMany({
    where: {
      storeId,
      ...(type ? { type: type as never } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
  });
  res.json(expenses);
});

const expenseSchema = z.object({
  storeId: z.string().min(1),
  type: expenseType,
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  date: z.string().datetime(),
});

expensesRouter.post("/", async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== parsed.data.storeId) {
    return res.status(403).json({ error: "No puedes registrar gastos para otra tienda" });
  }
  const expense = await prisma.expense.create({
    data: { ...parsed.data, date: new Date(parsed.data.date), createdById: req.auth!.userId },
  });
  res.status(201).json(expense);
});

expensesRouter.put("/:id", async (req, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { date, ...rest } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: { ...rest, date: date ? new Date(date) : undefined },
  });
  res.json(expense);
});

expensesRouter.delete("/:id", async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
