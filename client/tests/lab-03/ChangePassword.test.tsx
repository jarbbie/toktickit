import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const initialUser = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER" as const, isActive: true, mustChangePassword: true };
const changedUser = { ...initialUser, mustChangePassword: false };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 Change Password", () => {
  it("blocks mismatched confirmation locally and saves only current/new password values", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: initialUser, expiresAt: "2026-09-19T00:00:00.000Z" });
    const change = vi.spyOn(api, "changePassword").mockResolvedValue({ user: changedUser, expiresAt: "2026-09-19T00:00:00.000Z" });
    vi.spyOn(api, "loadReferenceData").mockResolvedValue({ categories: [], relatedSystems: [] });
    vi.spyOn(api, "loadRequesterDashboard").mockResolvedValue({
      asOf: "2026-10-30T00:00:00.000Z", windowStart: "2026-10-24T17:00:00.000Z",
      counts: { openTickets: { count: 0, href: "/tickets?statusGroup=open" }, waitingForRequester: { count: 0, href: "/tickets?status=WAITING_FOR_REQUESTER" }, recentlyResolved: { count: 0, href: "/tickets?statusGroup=resolved" } },
      recentlyUpdated: [], recentlyResolvedTickets: [],
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/tickets"]}><App /></MemoryRouter>);

    const showNewPassword = await screen.findByRole("button", { name: "Show New Password" });
    expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "password");
    await user.click(showNewPassword);
    expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide New Password" })).toBeInTheDocument();

    await user.type(await screen.findByLabelText("Current Password"), "Lab3-Initial-2026!");
    await user.type(screen.getByLabelText("New Password"), "Changed-Lab3-Password!");
    await user.type(screen.getByLabelText("Confirm New Password"), "Different-Lab3-Password!");
    await user.click(screen.getByRole("button", { name: "Save Password" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText("Passwords must match exactly.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Confirm New Password"));
    await user.type(screen.getByLabelText("Confirm New Password"), "Lab3-Initial-2026!");
    await user.clear(screen.getByLabelText("New Password"));
    await user.type(screen.getByLabelText("New Password"), "Lab3-Initial-2026!");
    await user.click(screen.getByRole("button", { name: "Save Password" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText("Your new password must differ from your current password.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("New Password"));
    await user.type(screen.getByLabelText("New Password"), "Changed-Lab3-Password!");
    await user.clear(screen.getByLabelText("Confirm New Password"));
    await user.type(screen.getByLabelText("Confirm New Password"), "Changed-Lab3-Password!");
    await user.click(screen.getByRole("button", { name: "Save Password" }));
    expect(change).toHaveBeenCalledWith("Lab3-Initial-2026!", "Changed-Lab3-Password!");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
