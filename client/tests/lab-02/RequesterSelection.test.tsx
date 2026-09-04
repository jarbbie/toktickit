import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const referenceData = {
  requesters: [{ id: 1, name: "Nicha Somchai", email: "nicha@example.test" }],
  categories: [{ id: 1, name: "Hardware" }],
  relatedSystems: [{ id: 1, name: "VPN" }],
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

function renderApp(path = "/select") {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("Development Requester selection", () => {
  it("shows a loading state while reference data is loading", () => {
    vi.spyOn(api, "loadReferenceData").mockReturnValue(new Promise(() => {}));

    renderApp();

    expect(screen.getByText("Loading Development Requesters…")).toBeInTheDocument();
  });

  it("selects an active requester and supports changing it", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue(referenceData);
    vi.spyOn(api, "loadTickets").mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    const user = userEvent.setup();
    renderApp();

    await user.selectOptions(await screen.findByLabelText(/Development Requester/), "1");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const profile = screen.getByText("Profile: Nicha Somchai", { exact: true });
    expect(profile).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("1");

    await user.click(profile);
    await user.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("shows an empty state when no active requester exists", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue({ ...referenceData, requesters: [] });

    renderApp();

    expect(await screen.findByText("No active Development Requesters are available.")).toBeInTheDocument();
  });

  it("shows a retryable failure state", async () => {
    vi.spyOn(api, "loadReferenceData")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(referenceData);
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load requester and reference data.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
  });
});
