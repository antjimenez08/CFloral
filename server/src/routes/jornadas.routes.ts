import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const jornadasRouter = Router();

jornadasRouter.use(requireAuth);

// Administración → Horarios → Jornadas: plantillas de turno con nombre reutilizables.
jornadasRouter.get("/", async (_req, res) => {
  const jornadas = await prisma.jornada.findMany({ orderBy: { name: "asc" } });
  res.json(jornadas);
});

const jornadaSchema = z.object({
  name: z.string().min(1),
  /// { LUN:true, MAR:true, ... DOM:false } — no se restringe de más a qué claves exactas trae.
  days: z.record(z.boolean()),
  start: z.string().min(1),
  end: z.string().min(1),
});

jornadasRouter.post("/", requirePermission("horarios"), async (req, res) => {
  const parsed = jornadaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const jornada = await prisma.jornada.create({ data: parsed.data });
  res.status(201).json(jornada);
});

const updateJornadaSchema = jornadaSchema.partial();

jornadasRouter.put("/:id", requirePermission("horarios"), async (req, res) => {
  const parsed = updateJornadaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const jornada = await prisma.jornada.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(jornada);
});

jornadasRouter.delete("/:id", requirePermission("horarios"), async (req, res) => {
  try {
    await prisma.jornada.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err: any) {
    // User.jornadaId no tiene onDelete explícito: si hay empleados usando esta
    // jornada, Prisma/MySQL lanza un error de restricción de clave foránea (P2003).
    if (err?.code === "P2003") {
      return res.status(400).json({ error: "No se puede eliminar: hay empleados usando esta jornada" });
    }
    throw err;
  }
});
