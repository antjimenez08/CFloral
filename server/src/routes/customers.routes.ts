import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const customersRouter = Router();

customersRouter.use(requireAuth);

function birthDateUpdate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  return new Date(value);
}

customersRouter.get("/", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          // La colación por defecto de MySQL (utf8mb4_*_ci) ya compara sin distinguir mayúsculas/minúsculas.
          OR: [{ name: { contains: search } }, { phone: { contains: search } }],
        }
      : undefined,
    include: { personas: { where: { isTitular: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  res.json(customers);
});

const addressSchema = z.object({
  label: z.string().min(1),
  recipientName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  zone: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

const specialDateSchema = z.object({
  label: z.string().min(1),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  notes: z.string().optional(),
});

const personaSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  isTitular: z.boolean().optional().default(false),
  phone: z.string().optional(),
  addresses: z.array(addressSchema).optional(),
  specialDates: z.array(specialDateSchema).optional(),
});

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  type: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
  documentId: z.string().optional(),
  birthDate: z.string().datetime().optional().or(z.literal("")).nullable(),
  acquisitionChannel: z.string().optional(),
  tags: z.string().optional(),
  paymentMethods: z.array(z.string()).optional(),
  emails: z.array(z.string()).optional(),
  addresses: z.array(addressSchema).optional(),
  specialDates: z.array(specialDateSchema).optional(),
});

customersRouter.post("/", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { addresses, specialDates, birthDate, paymentMethods, emails, ...rest } = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      ...rest,
      birthDate: birthDateUpdate(birthDate),
      paymentMethods: paymentMethods ?? [],
      emails: emails ?? [],
      personas: {
        create: {
          name: rest.name,
          relationship: "Titular",
          isTitular: true,
          phone: rest.phone,
          addresses: addresses?.length ? { create: addresses } : undefined,
          specialDates: specialDates?.length ? { create: specialDates } : undefined,
        },
      },
    },
    include: { personas: { include: { addresses: true, specialDates: true } } },
  });
  res.status(201).json(customer);
});

/// Sugerencias de "¿A quién debo contactar?" (igual que el mockup):
/// 1) fechas especiales en los próximos `days`, excluyendo a quien ya tiene un pedido para
///    esa persona en los últimos 20 días (no insistir si ya se le compró algo para esa fecha);
/// 2) clientes "fuera de su hábito de compra": con al menos 2 pedidos (para tener un intervalo
///    promedio entre compras), cuyos días desde la última compra caen entre 0.85x y 1.6x ese
///    promedio — es decir, ya deberían estar volviendo a comprar según su propio patrón.
/// Debe declararse antes de GET /:id para que Express no la confunda con un id de cliente.
customersRouter.get("/contact-suggestions", async (req, res) => {
  const withinDays = Number(req.query.days) || 21;
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dates = await prisma.customerSpecialDate.findMany({
    include: { persona: { include: { customer: true, orders: { select: { createdAt: true } } } } },
  });
  const specialDateSuggestions = dates
    .map((d) => {
      let next = new Date(today.getFullYear(), d.month - 1, d.day);
      if (next < now) next = new Date(today.getFullYear() + 1, d.month - 1, d.day);
      const daysUntil = Math.round((next.getTime() - now.getTime()) / 86400000);
      const recentlyOrdered = d.persona.orders.some(
        (o) => (now.getTime() - new Date(o.createdAt).getTime()) / 86400000 <= 20
      );
      return { ...d, daysUntil, recentlyOrdered };
    })
    .filter((d) => d.daysUntil <= withinDays && !d.recentlyOrdered)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const customers = await prisma.customer.findMany({
    where: { ordersCount: { gte: 2 } },
    include: { orders: { where: { status: { not: "CANCELLED" } }, select: { createdAt: true }, orderBy: { createdAt: "asc" } } },
  });
  const habitSuggestions = customers
    .map((c) => {
      const dates = c.orders.map((o) => new Date(o.createdAt).getTime());
      if (dates.length < 2) return null;
      const first = dates[0];
      const last = dates[dates.length - 1];
      const avgIntervalDays = (last - first) / (dates.length - 1) / 86400000;
      const daysSinceLast = (now.getTime() - last) / 86400000;
      if (avgIntervalDays <= 0) return null;
      if (daysSinceLast < avgIntervalDays * 0.85 || daysSinceLast > avgIntervalDays * 1.6) return null;
      return { customer: c, daysSinceLast: Math.round(daysSinceLast), avgIntervalDays: Math.round(avgIntervalDays) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast);

  res.json({ specialDates: specialDateSuggestions, habitual: habitSuggestions });
});

customersRouter.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 50 },
      personas: {
        orderBy: { isTitular: "desc" },
        include: {
          addresses: { orderBy: { isDefault: "desc" } },
          specialDates: { orderBy: [{ month: "asc" }, { day: "asc" }] },
        },
      },
    },
  });
  if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(customer);
});

customersRouter.put("/:id", async (req, res) => {
  const parsed = customerSchema
    .omit({ addresses: true, specialDates: true })
    .partial()
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { birthDate, ...rest } = parsed.data;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { ...rest, birthDate: birthDateUpdate(birthDate) },
  });
  if (rest.name !== undefined || rest.phone !== undefined) {
    await prisma.persona.updateMany({
      where: { customerId: req.params.id, isTitular: true },
      data: { ...(rest.name !== undefined ? { name: rest.name } : {}), ...(rest.phone !== undefined ? { phone: rest.phone } : {}) },
    });
  }
  res.json(customer);
});

customersRouter.post("/:id/personas", async (req, res) => {
  const parsed = personaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { addresses, specialDates, ...rest } = parsed.data;
  const persona = await prisma.persona.create({
    data: {
      ...rest,
      customerId: req.params.id,
      addresses: addresses?.length ? { create: addresses } : undefined,
      specialDates: specialDates?.length ? { create: specialDates } : undefined,
    },
    include: { addresses: true, specialDates: true },
  });
  res.status(201).json(persona);
});

customersRouter.put("/personas/:personaId", async (req, res) => {
  const parsed = personaSchema.omit({ addresses: true, specialDates: true }).partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const persona = await prisma.persona.update({ where: { id: req.params.personaId }, data: parsed.data });
  res.json(persona);
});

customersRouter.delete("/personas/:personaId", async (req, res) => {
  await prisma.persona.delete({ where: { id: req.params.personaId } });
  res.status(204).end();
});

customersRouter.post("/personas/:personaId/addresses", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const address = await prisma.customerAddress.create({
    data: { ...parsed.data, personaId: req.params.personaId },
  });
  res.status(201).json(address);
});

customersRouter.put("/personas/:personaId/addresses/:addressId", async (req, res) => {
  const parsed = addressSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const address = await prisma.customerAddress.update({
    where: { id: req.params.addressId },
    data: parsed.data,
  });
  res.json(address);
});

customersRouter.delete("/personas/:personaId/addresses/:addressId", async (req, res) => {
  await prisma.customerAddress.delete({ where: { id: req.params.addressId } });
  res.status(204).end();
});

customersRouter.post("/personas/:personaId/special-dates", async (req, res) => {
  const parsed = specialDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const specialDate = await prisma.customerSpecialDate.create({
    data: { ...parsed.data, personaId: req.params.personaId },
  });
  res.status(201).json(specialDate);
});

customersRouter.delete("/personas/:personaId/special-dates/:dateId", async (req, res) => {
  await prisma.customerSpecialDate.delete({ where: { id: req.params.dateId } });
  res.status(204).end();
});

/// Próximas fechas especiales (cumpleaños, aniversarios) dentro de N días, para
/// poder contactar al cliente antes de la fecha.
customersRouter.get("/special-dates/upcoming", async (req, res) => {
  const withinDays = Number(req.query.days) || 30;
  const today = new Date();
  const dates = await prisma.customerSpecialDate.findMany({
    include: { persona: { include: { customer: true } } },
  });

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

