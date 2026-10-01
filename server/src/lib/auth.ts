import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export type AppRole = "ADMIN" | "GERENTE" | "ADMINISTRATIVO" | "VENDEDOR";

export interface AuthTokenPayload {
  userId: string;
  role: AppRole;
  storeId: string | null;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
