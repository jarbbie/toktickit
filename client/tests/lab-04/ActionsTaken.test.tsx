import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import ActionsTaken from "../../src/ActionsTaken.js";
import type { ActionRecord, ActionSnapshot, ActionEvent } from "../../src/api.js";

const performer = { id: 7, name: "Support One", role: "IT_STAFF" as const };
const activeOptions = [performer, { id: 9, name: "Admin One", role: "ADMINISTRATOR" as const }];
const snapshot: ActionSnapshot = {
  actionAt: "2026-10-29T02:30:00.000Z", description: "Inspect VPN service", result: null, performedBy: performer,
  assignee: null, status: "PLANNED", followUpRequired: false, followUpNote: null, attachmentNotes: "Look for vpn.pdf", version: 1,
};
const createdEvent: ActionEvent = { id: 1, actionId: 11, actor: performer, type: "CREATED", before: null, after: snapshot, createdAt: "2026-10-29T02:31:00.000Z" };
const action: ActionRecord = {
  id: 11, ticketId: 4, ...snapshot, createdAt: "2026-10-29T02:31:00.000Z", updatedAt: "2026-10-29T02:31:00.000Z", events: [createdEvent],
};

function renderActions(props: Partial<React.ComponentProps<typeof ActionsTaken>> = {}) {
  return render(<ActionsTaken ticketId={4} ticketStatus="OPEN" workflowVersion={2} currentUserName="Support One" assigneeOptions={activeOptions} refreshTicket={async () => 3} {...props} />);
}

function loadList(items: ActionRecord[] = [action]) {
  return vi.spyOn(api, "loadActions").mockResolvedValue(items);
}

afterEach(() => vi.restoreAllMocks());

describe("Actions Taken on Ticket Detail", () => {
  it("shows requester-safe Action information without history or writable controls", async () => {
    loadList();
    renderActions({ readOnly: true });

    expect(await screen.findByText("Inspect VPN service")).toBeInTheDocument();
    expect(screen.getAllByText("Look for vpn.pdf").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Support One (IT Staff)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Action history/)).not.toBeInTheDocument();
  });

  it("shows support history as read-only changed-field snapshots", async () => {
    loadList();
    const user = userEvent.setup();
    renderActions();

    await user.click(await screen.findByText("Action history (1 event)"));
    expect(screen.getByText("CREATED")).toBeInTheDocument();
    expect(screen.getByText("Action date/time")).toBeInTheDocument();
    expect(screen.getAllByText("Look for vpn.pdf").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("validates follow-up fields and creates with the signed-in performer and idempotency key", async () => {
    const load = loadList([]);
    const create = vi.spyOn(api, "createAction").mockResolvedValue(action);
    const refreshTicket = vi.fn().mockResolvedValue(3);
    const user = userEvent.setup();
    renderActions({ refreshTicket });

    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    expect(screen.getByText("Performed by:")).toBeInTheDocument();
    expect(screen.getByText("Support One", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    expect(await screen.findByText("Description must be between 1 and 2000 characters.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Action Description/), " Check gateway health ");
    await user.selectOptions(screen.getByLabelText("Assignee"), "9");
    await user.click(screen.getByLabelText("Follow-Up Required"));
    await user.type(screen.getByLabelText(/Follow-up Note/), "Call requester tomorrow");
    await user.type(screen.getByLabelText("Attachment Notes"), "See the VPN screenshot");
    await user.click(screen.getByRole("button", { name: "Create Action" }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const [ticketId, input, key] = create.mock.calls[0];
    expect(ticketId).toBe(4);
    expect(input).toMatchObject({ description: "Check gateway health", assigneeId: 9, followUpRequired: true, followUpNote: "Call requester tomorrow", attachmentNotes: "See the VPN screenshot", expectedWorkflowVersion: 2 });
    expect(new Date(input.actionAt).toISOString()).toBe(input.actionAt);
    expect(key).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    expect(await screen.findByText("Action created.")).toHaveAttribute("role", "status");
    expect(refreshTicket).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Attachment Notes")).not.toBeInTheDocument();
  });

  it("reuses the same create key after a recoverable failure and preserves the form", async () => {
    loadList([]);
    const create = vi.spyOn(api, "createAction").mockRejectedValueOnce(new api.ApiError("Temporary server error.", 500)).mockResolvedValue(action);
    const user = userEvent.setup();
    renderActions();

    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    await user.type(screen.getByLabelText(/Action Description/), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary server error.");
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Keep this draft");

    await user.click(screen.getByRole("button", { name: "Create Action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[0][2]).toBe(create.mock.calls[1][2]);
  });

  it("refreshes the active assignee choices on an inactive-account conflict and keeps the assignment form open", async () => {
    loadList([{ ...action, assignee: performer }]);
    vi.spyOn(api, "assignAction").mockRejectedValue(new api.ApiError("Unavailable.", 409, "ACTION_ASSIGNEE_UNAVAILABLE"));
    const refreshTicket = vi.fn().mockResolvedValue(3);
    const user = userEvent.setup();
    renderActions({ refreshTicket });

    await user.click(await screen.findByRole("button", { name: "Change assignee" }));
    await user.selectOptions(screen.getByLabelText("Assignee"), "9");
    await user.click(screen.getByRole("button", { name: "Save assignee" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That assignee is unavailable.");
    expect(screen.getByLabelText("Assignee")).toBeInTheDocument();
    expect(refreshTicket).toHaveBeenCalledOnce();
  });

  it("preserves an edit draft across a stale-version conflict and uses the refreshed version after review", async () => {
    const latest = { ...action, description: "A newer edit from another staff member", version: 2 };
    const load = vi.spyOn(api, "loadActions").mockResolvedValueOnce([action]).mockResolvedValue([latest]);
    const edit = vi.spyOn(api, "editAction").mockRejectedValueOnce(new api.ApiError("Stale.", 409, "STALE_ACTION")).mockResolvedValue({ ...latest, description: "Manual correction", version: 3 });
    const user = userEvent.setup();
    renderActions();

    await user.click(await screen.findByRole("button", { name: "Edit Action" }));
    const description = screen.getByLabelText(/Action Description/);
    await user.clear(description);
    await user.type(description, "Manual correction");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This Action or Ticket changed.");
    expect(description).toHaveValue("Manual correction");

    await user.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[0][1].expectedVersion).toBe(1);
    expect(edit.mock.calls[1][1].expectedVersion).toBe(2);
    expect(edit.mock.calls[1][1].expectedWorkflowVersion).toBe(3);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("requires a Result before completion and confirms cancellation without submitting when dismissed", async () => {
    loadList();
    const transition = vi.spyOn(api, "transitionAction").mockResolvedValue({ ...action, status: "COMPLETED", result: "Resolved" });
    const user = userEvent.setup();
    renderActions();

    await user.click(await screen.findByRole("button", { name: "Complete" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Complete Action");
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByText("A Result between 1 and 2000 characters is required before completion.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Result/), "Resolved after service restart");
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(11, { expectedVersion: 1, expectedWorkflowVersion: 2, status: "COMPLETED", result: "Resolved after service restart" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Action completed.");
    expect(transition).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancel Action" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Cancel Action");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(transition).toHaveBeenCalledOnce();
  });

  it("hides writes on a terminal parent but leaves existing Actions readable", async () => {
    loadList();
    renderActions({ ticketStatus: "CANCELLED" });

    await waitFor(() => expect(screen.getAllByText("Inspect VPN service").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText(/This Ticket is cancelled/)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action" })).not.toBeInTheDocument();
  });

  it("shows a safe forbidden response without stale Action information", async () => {
    vi.spyOn(api, "loadActions").mockRejectedValue(new api.ApiError("Forbidden.", 403, "FORBIDDEN"));
    renderActions({ readOnly: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view Actions for this Ticket.");
    expect(screen.queryByText("Inspect VPN service")).not.toBeInTheDocument();
  });
});
