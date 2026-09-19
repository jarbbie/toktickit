import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const staff = { id: 7, name: "Support One", email: "support.one@toktickit.test", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 authenticated shell", () => {
  it("shows role navigation, blocks an unauthorized direct route, and logs out", async () => {
    vi.spyOn(api, "currentUser").mockResolvedValue({ user: staff, expiresAt: "2026-09-19T00:00:00.000Z" });
    const signOut = vi.spyOn(api, "logout").mockResolvedValue();
    const user = userEvent.setup();
    sessionStorage.setItem("toktickit.requesterId", "999");
    render(<MemoryRouter initialEntries={["/tickets"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
    expect(screen.getAllByText("Support One")[0]).toBeInTheDocument();
    expect(screen.getAllByText("IT Staff")[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument();

    await user.click(screen.getAllByText("Support One")[0]);
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
