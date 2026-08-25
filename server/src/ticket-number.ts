import { randomBytes } from "node:crypto";

export function generateTicketNumber(date = new Date()) {
  return `TKT-${date.getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
