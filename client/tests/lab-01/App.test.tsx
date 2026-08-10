import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online when the health check succeeds", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [{ id: 1, name: "Account and Access" }],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
  });

  it("shows a loading state while the system check is pending", async () => {
    vi.spyOn(api, "checkSystem").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("shows a useful Offline error when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("Backend unavailable"));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText(/Offline — Unable to reach the API/i)).toBeInTheDocument();
  });
});
