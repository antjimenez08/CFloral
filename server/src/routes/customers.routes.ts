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
          // La colación por defecto de MySQL (utf8mb4_*_ci) ya compara sin distinguir mayúsculas/minúsculas.
          OR: [{ name: { contains: search } }, { phone: { contains: search } }],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
  res.json(customers);
});

const contactChannel = z.enum([
  "WALK_IN",
  "PHONE",
  "WHATSAPP",
  "EMAIL",
  "WEBSITE",
  "SOCIAL_MEDIA",
  "MARKETPLACE",
  "REFERRAL",
  "OTHER",
]);

const addressSchema = z.object({
  label: z.string().min(1),
  recipientName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

const specialDateSchema = z.object({
  label: z.string().min(1),
  occasion: z
    .enum([
      "BIRTHDAY",
      "ANNIVERSARY",
      "SYMPATHY",
      "WEDDING",
      "GET_WELL",
      "CONGRATULATIONS",
      "ROMANCE",
      "NEW_BABY",
      "GRADUATION",
      "CORPORATE",
      "MOTHERS_DAY",
      "VALENTINES",
      "NO_OCCASION",
      "OTHER",
    ])
    .optional(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  notes: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  type: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
  documentId: z.string().optional(),
  birthDate: z.string().datetime().optional().or(z.literal("")),
  preferredContact: contactChannel.optional(),
  acquisitionChannel: contactChannel.optional(),
  tags: z.string().optional(),
  addresses: z.array(addressSchema).optional(),
  specialDates: z.array(specialDateSchema).optional(),
});

customersRouter.post("/", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { addresses, specialDates, birthDate, ...rest } = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      ...rest,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      addresses: addresses?.length ? { create: addresses } : undefined,
      specialDates: specialDates?.length ? { create: specialDates } : undefined,
    },
    include: { addresses: true, specialDates: true },
  });
  res.status(201).json(customer);
});

customersRouter.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      addresses: { orderBy: { isDefault: "desc" } },
      specialDates: { orderBy: [{ month: "asc" }, { day: "asc" }] },
    },
  });
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(customer);
});

customersRouter.put("/:id", async (req, res) => {
  const parsed = customerSchema.omit({ addresses: true, specialDates: true }).partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { birthDate, ...rest } = parsed.data;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { ...rest, birthDate: birthDate ? new Date(birthDate) : undefined },
  });
  res.json(customer);
});

customersRouter.post("/:id/addresses", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const address = await prisma.customerAddress.create({
    data: { ...parsed.data, customerId: req.params.id },
  });
  res.status(201).json(address);
});

customersRouter.delete("/:id/addresses/:addressId", async (req, res) => {
  await prisma.customerAddress.delete({ where: { id: req.params.addressId } });
  res.status(204).end();
});

customersRouter.post("/:id/special-dates", async (req, res) => {
  const parsed = specialDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const specialDate = await prisma.customerSpecialDate.create({
    data: { ...parsed.data, customerId: req.params.id },
  });
  res.status(201).json(specialDate);
});

customersRouter.delete("/:id/special-dates/:dateId", async (req, res) => {
  await prisma.customerSpecialDate.delete({ where: { id: req.params.dateId } });
  res.status(204).end();
});

/// Próximas fechas especiales (cumpleaños, aniversarios) dentro de N días, para
/// poder contactar al cliente antes de la fecha. Base para recordatorios/alertas.
customersRouter.get("/special-dates/upcoming", async (req, res) => {
  const withinDays = Number(req.query.days) || 30;
  const today = new Date();
  const dates = await prisma.customerSpecialDate.findMany({ include: { customer: true } });

  const upcoming = dates
    .map((d) => {
      const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let next = new Date(today.getFullYear(), d.month - 1, d.day);
      if (next < now) next = new Date(today.getFullYear() + 1, d.month - 1, d.day);
      const daysUntil = Math.round((next.getTime() - now.getTime()) / 86400000);
      return { ...d, daysUntil };
    })
    .filter((d) => d.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  res.json(upcoming);
});
