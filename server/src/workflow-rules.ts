import type { ActionStatus, TicketStatus } from "@prisma/client";

export const actionStatusTransitions: Record<ActionStatus, readonly ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ticketStatusTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export function isActionStatusTransitionAllowed(from: ActionStatus, to: ActionStatus): boolean {
  return actionStatusTransitions[from].includes(to);
}

export function isTicketStatusTransitionAllowed(from: TicketStatus, to: TicketStatus): boolean {
  return ticketStatusTransitions[from].includes(to);
}
