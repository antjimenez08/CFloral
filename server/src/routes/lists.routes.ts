import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const listsRouter = Router();

listsRouter.use(requireAuth);

// Administración → Listas desplegables: todas las listas (ListOption) agrupadas por listKey,
// más la lista virtual "occasions" = valores distintos de CardMessageTemplate.occasion.
listsRouter.get("/", async (_req, res) => {
  const [options, templates] = await Promise.all([
    prisma.listOption.findMany({ orderBy: [{ listKey: "asc" }, { sortOrder: "asc" }] }),
    prisma.cardMessageTemplate.findMany({ select: { occasion: true } }),
  ]);
  const grouped: Record<string, string[]> = {};
  for (const option of options) {
    if (!grouped[option.listKey]) grouped[option.listKey] = [];
    grouped[option.listKey].push(option.value);
  }
  const occasions = Array.from(new Set(templates.map((t) => t.occasion))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
  res.json({ ...grouped, occasions });
});

const addValueSchema = z.object({ value: z.string().min(1) });

// Agrega un valor a una lista. Las ocasiones se gestionan vía /lists/card-messages
// (una ocasión solo existe si tiene al menos un mensaje asociado), no aquí.
listsRouter.post("/:listKey", requirePermission("listas"), async (req, res) => {
  const { listKey } = req.params;
  if (listKey === "occasions") {
    return res.status(400).json({ error: "Usa /lists/card-messages para agregar ocasiones" });
  }
  const parsed = addValueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { value } = parsed.data;
  // Deduplicado global case-insensitive, igual que en el mockup. MySQL no soporta el
  // filtro `mode: "insensitive"` de Prisma, así que comparamos en JS para no depender
  // del collation de la columna.
  const siblings = await prisma.listOption.findMany({ where: { listKey } });
  const existing = siblings.find((o) => o.value.toLowerCase() === value.toLowerCase());
  if (existing) return res.status(200).json(existing);

  const max = await prisma.listOption.aggregate({
    where: { listKey },
    _max: { sortOrder: true },
  });
  const option = await prisma.listOption.create({
    data: { listKey, value, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(option);
});

// Elimina un valor de una lista (match exacto). No afecta retroactivamente registros
// que ya usaban ese valor (es solo un campo de texto libre en otros modelos).
listsRouter.delete("/:listKey/:value", requirePermission("listas"), async (req, res) => {
  const { listKey, value } = req.params;
  await prisma.listOption.deleteMany({ where: { listKey, value } });
  res.status(204).end();
});

// Mensajes de tarjeta sugeridos por ocasión (la fuente de la lista virtual "occasions").
listsRouter.get("/card-messages", async (req, res) => {
  const occasion = typeof req.query.occasion === "string" ? req.query.occasion : undefined;
  const templates = await prisma.cardMessageTemplate.findMany({
    where: occasion ? { occasion } : undefined,
    orderBy: [{ occasion: "asc" }, { sortOrder: "asc" }],
  });
  res.json(templates);
});

const cardMessageSchema = z.object({
  occasion: z.string().min(1),
  message: z.string().min(1),
});

listsRouter.post("/card-messages", requirePermission("listas"), async (req, res) => {
  const parsed = cardMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { occasion, message } = parsed.data;
  const max = await prisma.cardMessageTemplate.aggregate({
    where: { occasion },
    _max: { sortOrder: true },
  });
  const template = await prisma.cardMessageTemplate.create({
    data: { occasion, message, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(template);
});

listsRouter.delete("/card-messages/:id", requirePermission("listas"), async (req, res) => {
  await prisma.cardMessageTemplate.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
