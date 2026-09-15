import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const customersRouter = Router();

customersRouter.use(requireAuth);

customersRouter.get("/", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
  res.json(customers);
});

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

customersRouter.post("/", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const customer = await prisma.customer.create({ data: parsed.data });
  res.status(201).json(customer);
});

customersRouter.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(customer);
});

customersRouter.put("/:id", async (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(customer);
});
