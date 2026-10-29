import { describe, expect, it } from "vitest";
import type { ActionStatus, TicketStatus } from "@prisma/client";
import {
  actionStatusTransitions,
  isActionStatusTransitionAllowed,
  isTicketStatusTransitionAllowed,
  ticketStatusTransitions,
} from "../../src/workflow-rules.js";

const actionStatuses: ActionStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const ticketStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

describe("workflow transition rules", () => {
  it("checks every Action status pair against the contract matrix", () => {
    for (const from of actionStatuses) {
      for (const to of actionStatuses) {
        expect(isActionStatusTransitionAllowed(from, to), `${from} -> ${to}`).toBe(actionStatusTransitions[from].includes(to));
      }
    }
  });

  it("checks every Ticket status pair against the contract matrix", () => {
    for (const from of ticketStatuses) {
      for (const to of ticketStatuses) {
        expect(isTicketStatusTransitionAllowed(from, to), `${from} -> ${to}`).toBe(ticketStatusTransitions[from].includes(to));
      }
    }
  });
});
