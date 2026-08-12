import { useState } from "react";
import { Category, checkSystem } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-4">
          <div className="alert alert-success d-flex align-items-center gap-3" role="status">
            <span className="fs-4" aria-hidden="true">✓</span>
            <div>
              <div className="fw-semibold">System Status</div>
              <div>Online</div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Supported Request Categories</div>
            <ul className="list-group list-group-flush">
              {categories.map((category, index) => (
                <li className="list-group-item d-flex align-items-center gap-3" key={category.id}>
                  <span className="badge text-bg-success rounded-pill">{index + 1}</span>
                  <span>{category.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="alert alert-danger mt-4" role="alert">
          <div className="fw-semibold">System Status: Offline</div>
          <div>Unable to reach the API. Please try again.</div>
        </div>
      )}
    </div>
  );
}
