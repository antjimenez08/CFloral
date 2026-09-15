import { ZodError } from "zod";

export function zodMessage(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
