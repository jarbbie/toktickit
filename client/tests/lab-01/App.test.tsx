import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("renders the TokTickIT heading", async () => {
    vi.spyOn(api, "loadReferenceData").mockResolvedValue({ requesters: [], categories: [], relatedSystems: [] });
    render(<MemoryRouter initialEntries={["/select"]}><App /></MemoryRouter>);

    expect(await screen.findByText(/TokTickIT/i)).toBeInTheDocument();
    expect(await screen.findByText("No active Development Requesters are available.")).toBeInTheDocument();
  });
});
