import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import UserManagement from "../../src/UserManagement.js";
import * as api from "../../src/api.js";
import type { AdminUserRecord } from "../../src/api.js";

const administrator = { id: 9, name: "Admin One", email: "admin.one@toktickit.test", role: "ADMINISTRATOR" as const, isActive: true, mustChangePassword: false };
const requester = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER" as const, isActive: true, mustChangePassword: false };
const users: AdminUserRecord[] = [
  { ...requester, createdAt: "2026-09-18T08:00:00.000Z", updatedAt: "2026-09-18T08:00:00.000Z" },
  { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF", isActive: false, mustChangePassword: true, createdAt: "2026-09-18T09:00:00.000Z", updatedAt: "2026-09-18T09:00:00.000Z" },
  { ...administrator, createdAt: "2026-09-18T07:00:00.000Z", updatedAt: "2026-09-18T07:00:00.000Z" },
];

afterEach(() => vi.restoreAllMocks());

function renderManagement() {
  return render(<MemoryRouter><UserManagement currentUserId={administrator.id} /></MemoryRouter>);
}

describe("Administrator User Management", () => {
  it("loads a safe user list and sends search and one-role filters", async () => {
    const loadUsers = vi.spyOn(api, "loadAdminUsers").mockResolvedValue(users);
    const user = userEvent.setup();
    renderManagement();

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getAllByText("support.one@toktickit.test").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Initial password change required").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Search users"), "support");
    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith("support", ""));
    await user.selectOptions(screen.getByLabelText("Filter by role"), "IT_STAFF");
    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith("support", "IT_STAFF"));
  });

  it("renders the Administrator screen inside the authenticated shell", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: administrator, expiresAt: "2026-09-19T00:00:00.000Z" });
    vi.spyOn(api, "loadAdminUsers").mockResolvedValue(users);
    render(<MemoryRouter initialEntries={["/admin/users"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getAllByText("Admin One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
  });

  it("validates and creates an account, then clears password fields", async () => {
    vi.spyOn(api, "loadAdminUsers").mockResolvedValue(users);
    const create = vi.spyOn(api, "createAdminUser").mockResolvedValue({ ...requester, id: 22, createdAt: "2026-09-19T08:00:00.000Z", updatedAt: "2026-09-19T08:00:00.000Z" });
    const user = userEvent.setup();
    renderManagement();

    await user.click(await screen.findByRole("button", { name: "+ Create user" }));
    await user.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("Display name must be between 1 and 100 characters.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Display name/), "  New Requester  ");
    await user.type(screen.getByLabelText(/Email/), " NEW@Example.TEST ");
    await user.selectOptions(screen.getByLabelText("User role"), "REQUESTER");
    await user.type(screen.getByLabelText("Initial password"), "CorrectHorseBattery1!");
    await user.type(screen.getByLabelText("Confirm password"), "CorrectHorseBattery1!");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: "New Requester", email: "NEW@Example.TEST", role: "REQUESTER", isActive: true, initialPassword: "CorrectHorseBattery1!" }));
    expect(await screen.findByRole("status")).toHaveTextContent("User created");
    expect(screen.queryByLabelText("Initial password")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });

  it("edits activation with confirmation and resets a password without displaying it", async () => {
    vi.spyOn(api, "loadAdminUsers").mockResolvedValue(users);
    const update = vi.spyOn(api, "updateAdminUser").mockResolvedValue({ ...users[1], isActive: true });
    const reset = vi.spyOn(api, "resetAdminUserPassword").mockResolvedValue(users[1]);
    const user = userEvent.setup();
    renderManagement();

    const editRequesterButtons = await screen.findAllByRole("button", { name: "Edit Nicha Somchai" });
    await user.click(editRequesterButtons[0]);
    await user.click(screen.getByLabelText("Account active"));
    expect(screen.getByText(/I understand this deactivates/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /I understand this deactivates/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ isActive: false, role: "REQUESTER" })));

    const resetSupportButtons = await screen.findAllByRole("button", { name: "Reset initial password for Support One" });
    await user.click(resetSupportButtons[0]);
    await user.type(screen.getByLabelText("New initial password"), "AnotherSecurePass1!");
    await user.type(screen.getByLabelText("Confirm password"), "AnotherSecurePass1!");
    await user.click(screen.getByRole("button", { name: "Set initial password" }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith(7, "AnotherSecurePass1!"));
    expect(await screen.findByText(/Initial password reset/)).toBeInTheDocument();
    expect(screen.queryByLabelText("New initial password")).not.toBeInTheDocument();
  });

  it("keeps drafts and exposes safe conflict feedback", async () => {
    vi.spyOn(api, "loadAdminUsers").mockResolvedValue(users);
    vi.spyOn(api, "createAdminUser").mockRejectedValue(new api.ApiError("Email is already in use.", 409, "EMAIL_IN_USE", { email: "Email is already in use." }));
    const user = userEvent.setup();
    renderManagement();

    await user.click(await screen.findByRole("button", { name: "+ Create user" }));
    await user.type(screen.getByLabelText(/Display name/), "Duplicate");
    await user.type(screen.getByLabelText(/Email/), "duplicate@example.test");
    await user.selectOptions(screen.getByLabelText("User role"), "REQUESTER");
    await user.type(screen.getByLabelText("Initial password"), "CorrectHorseBattery1!");
    await user.type(screen.getByLabelText("Confirm password"), "CorrectHorseBattery1!");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email is already in use.");
    expect(screen.getByLabelText(/Display name/)).toHaveValue("Duplicate");
    expect(screen.getByLabelText("Initial password")).toHaveValue("CorrectHorseBattery1!");
    expect(screen.getByLabelText(/Email/)).toHaveClass("is-invalid");
  });

  it("distinguishes an empty list from a safe loading failure", async () => {
    const loadUsers = vi.spyOn(api, "loadAdminUsers").mockResolvedValueOnce([]);
    const emptyRender = renderManagement();
    expect(await screen.findByText("No users match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    emptyRender.unmount();

    loadUsers.mockRejectedValue(new api.ApiError("Unable to load users.", 500));
    renderManagement();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load users.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("denies a Requester direct navigation to the Administrator route", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: requester, expiresAt: "2026-09-19T00:00:00.000Z" });
    render(<MemoryRouter initialEntries={["/admin/users"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "User Management" })).not.toBeInTheDocument();
  });
});
