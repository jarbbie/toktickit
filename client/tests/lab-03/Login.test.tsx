import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const initialUser = { id: 1, name: "Nicha Somchai", email: "nicha@toktickit.test", role: "REQUESTER" as const, isActive: true, mustChangePassword: true };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 Login", () => {
  it("validates fields locally, preserves email on a safe credential failure, and prevents duplicate submission", async () => {
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiError("Authentication is required.", 401));
    const signIn = vi.spyOn(api, "login").mockRejectedValue(new api.ApiError("Unable to sign in.", 401, "INVALID_CREDENTIALS"));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(signIn).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Email"), "nicha@toktickit.test");
    await user.type(screen.getByLabelText("Password"), "Lab3-Initial-2026!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in. Check your credentials or contact an administrator.");
    expect(screen.getByLabelText("Email")).toHaveValue("nicha@toktickit.test");
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("uses the password-change gate after successful initial-password login", async () => {
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiError("Authentication is required.", 401));
    vi.spyOn(api, "login").mockResolvedValue({ user: initialUser, expiresAt: "2026-09-19T00:00:00.000Z" });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Email"), initialUser.email);
    await user.type(screen.getByLabelText("Password"), "Lab3-Initial-2026!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Change your initial password to continue" })).toBeInTheDocument();
    expect(screen.queryByText("Development Requester Selection")).not.toBeInTheDocument();
  });

  it("shows a disabled busy state while a sign-in request is pending", async () => {
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiError("Authentication is required.", 401));
    let resolveLogin: ((result: api.AuthResult) => void) | undefined;
    vi.spyOn(api, "login").mockImplementation(() => new Promise((resolve) => { resolveLogin = resolve; }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);

    await user.type(await screen.findByLabelText("Email"), initialUser.email);
    await user.type(screen.getByLabelText("Password"), "Lab3-Initial-2026!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    resolveLogin?.({ user: initialUser, expiresAt: "2026-09-19T00:00:00.000Z" });
    expect(await screen.findByRole("heading", { name: "Change your initial password to continue" })).toBeInTheDocument();
  });
});
