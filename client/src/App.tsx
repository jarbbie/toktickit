import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { type CreatedTicket, type ReferenceData, type Requester, createTicket, loadReferenceData } from "./api.js";

type LoadState = "loading" | "ready" | "error";
type FormValues = { categoryId: string; relatedSystemId: string; requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; summary: string; description: string };
const requesterStorageKey = "toktickit.requesterId";

function savedRequesterId() {
  const id = Number(sessionStorage.getItem(requesterStorageKey));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function Shell({ requester, onChangeRequester, children }: { requester: Requester; onChangeRequester: () => void; children: ReactNode }) {
  return (
    <main className="min-vh-100" style={{ backgroundColor: "#F5F7F6" }}>
      <header className="border-bottom bg-white">
        <div className="container py-3 d-flex flex-wrap align-items-center gap-3" style={{ maxWidth: 1100 }}>
          <strong style={{ color: "#006B3C" }}>TokTickIT</strong>
          <nav className="d-flex gap-3" aria-label="Main navigation">
            <NavLink className={({ isActive }) => isActive ? "fw-semibold text-success text-decoration-underline" : "text-decoration-none"} to="/tickets">My Tickets</NavLink>
            <NavLink className={({ isActive }) => isActive ? "fw-semibold text-success text-decoration-underline" : "text-decoration-none"} to="/tickets/new">Create Ticket</NavLink>
          </nav>
          <span className="ms-md-auto">Requester: {requester.name}</span>
          <button className="btn btn-sm btn-outline-success" onClick={onChangeRequester}>Change Requester</button>
        </div>
      </header>
      <div className="container py-5" style={{ maxWidth: 900 }}>{children}</div>
    </main>
  );
}

function RequesterSelector({ data, onSelected }: { data: ReferenceData; onSelected: (id: number) => void }) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const navigate = useNavigate();

  if (data.requesters.length === 0) return <main className="container py-5"><h1 className="h3" style={{ color: "#006B3C" }}>TokTickIT</h1><div className="alert alert-warning mt-4" role="status">No active Development Requesters are available.</div></main>;

  function continueWithRequester() {
    if (!pendingId) return;
    onSelected(pendingId);
    navigate("/tickets");
  }

  return (
    <main className="container py-5" style={{ maxWidth: 640 }}>
      <header className="mb-4"><h1 className="h3 mb-1" style={{ color: "#006B3C" }}>TokTickIT</h1><p className="text-secondary mb-0">IT Service Desk</p></header>
      <section className="card shadow-sm"><div className="card-body">
        <h2 className="h4">Select Development Requester</h2>
        <p>This selector is for Lab 2 testing only. It is not a login screen.</p>
        <label className="form-label fw-semibold" htmlFor="requester">Development Requester</label>
        <select className="form-select mb-3" id="requester" value={pendingId ?? ""} onChange={(event) => setPendingId(Number(event.target.value) || null)}>
          <option value="">Choose a requester</option>
          {data.requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="btn text-white" style={{ backgroundColor: "#006B3C" }} disabled={!pendingId} onClick={continueWithRequester}>Continue</button>
      </div></section>
    </main>
  );
}

function CreateTicket({ requester, data }: { requester: Requester; data: ReferenceData }) {
  const [form, setForm] = useState<FormValues>({ categoryId: "", relatedSystemId: "", requestedPriority: "MEDIUM", summary: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");
  const [created, setCreated] = useState<CreatedTicket | null>(null);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.categoryId) next.categoryId = "Category is required.";
    if (!form.relatedSystemId) next.relatedSystemId = "Related System is required.";
    if (form.summary.trim().length < 5 || form.summary.trim().length > 200) next.summary = "Ticket Summary must be between 5 and 200 characters.";
    if (form.description.trim().length < 10 || form.description.trim().length > 4000) next.description = "Description must be between 10 and 4000 characters.";
    return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFailure("");
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      setCreated(await createTicket({ requesterId: requester.id, categoryId: Number(form.categoryId), relatedSystemId: Number(form.relatedSystemId), requestedPriority: form.requestedPriority, summary: form.summary, description: form.description }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unable to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <section className="card shadow-sm"><div className="card-body"><h1 className="h3">Ticket created: {created.ticketNumber}</h1><p>Your ticket is saved with status New.</p><NavLink className="btn text-white" style={{ backgroundColor: "#006B3C" }} to="/tickets">View My Tickets</NavLink></div></section>;

  const invalid = (name: string) => errors[name] ? "form-control is-invalid" : "form-control";
  const invalidSelect = (name: string) => errors[name] ? "form-select is-invalid" : "form-select";
  return (
    <section className="card shadow-sm"><div className="card-body">
      <h1 className="h3 mb-4">Create Ticket</h1>
      {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
      <form noValidate onSubmit={submit}>
        <div className="row g-3 mb-3">
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-requester">Requester</label><input className="form-control" id="ticket-requester" readOnly value={requester.name} style={{ backgroundColor: "#EAF6EF" }} /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-date">Ticket Date</label><input className="form-control" id="ticket-date" readOnly value="Generated on submission" style={{ backgroundColor: "#EAF6EF" }} /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-number">Ticket Number</label><input className="form-control" id="ticket-number" readOnly value="Generated after submission" style={{ backgroundColor: "#EAF6EF" }} /></div>
        </div>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="category">Category <span className="text-danger">*</span></label><select className={invalidSelect("categoryId")} id="category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">Choose a category</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.categoryId && <div className="invalid-feedback">{errors.categoryId}</div>}</div>
          <div className="col-md-6"><label className="form-label" htmlFor="related-system">Related System <span className="text-danger">*</span></label><select className={invalidSelect("relatedSystemId")} id="related-system" value={form.relatedSystemId} onChange={(event) => update("relatedSystemId", event.target.value)}><option value="">Choose a related system</option>{data.relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.relatedSystemId && <div className="invalid-feedback">{errors.relatedSystemId}</div>}</div>
          <div className="col-md-6"><label className="form-label" htmlFor="requested-priority">Requested Priority <span className="text-danger">*</span></label><select className="form-select" id="requested-priority" value={form.requestedPriority} onChange={(event) => update("requestedPriority", event.target.value as FormValues["requestedPriority"])}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority}>{priority}</option>)}</select></div>
          <div className="col-12"><label className="form-label" htmlFor="summary">Ticket Summary <span className="text-danger">*</span></label><input className={invalid("summary")} id="summary" value={form.summary} onChange={(event) => update("summary", event.target.value)} />{errors.summary && <div className="invalid-feedback">{errors.summary}</div>}</div>
          <div className="col-12"><label className="form-label" htmlFor="description">Description <span className={"text-danger"}>*</span></label><textarea className={invalid("description")} id="description" rows={5} value={form.description} onChange={(event) => update("description", event.target.value)} />{errors.description && <div className="invalid-feedback">{errors.description}</div>}</div>
        </div>
        <button className="btn text-white mt-4" style={{ backgroundColor: "#006B3C" }} disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit Ticket"}</button>
      </form>
    </div></section>
  );
}

export default function App() {
  const [state, setState] = useState<LoadState>("loading");
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [requesterId, setRequesterId] = useState<number | null>(savedRequesterId);

  async function load() {
    setState("loading");
    try {
      const data = await loadReferenceData();
      setReferenceData(data);
      setRequesterId((id) => data.requesters.some((requester) => requester.id === id) ? id : null);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => { void load(); }, []);

  if (state === "loading") return <main className="container py-5"><p role="status">Loading Development Requesters…</p></main>;
  if (state === "error") return <main className="container py-5"><div className="alert alert-danger" role="alert"><p>Unable to load requester and reference data.</p><button className="btn btn-danger" onClick={load}>Retry</button></div></main>;
  if (!referenceData) return null;

  const requester = referenceData.requesters.find((item) => item.id === requesterId);
  if (!requester) return <Routes><Route path="/select" element={<RequesterSelector data={referenceData} onSelected={(id) => { sessionStorage.setItem(requesterStorageKey, String(id)); setRequesterId(id); }} />} /><Route path="*" element={<Navigate replace to="/select" />} /></Routes>;

  const changeRequester = () => { sessionStorage.removeItem(requesterStorageKey); setRequesterId(null); };
  return <Routes>
    <Route path="/select" element={<Navigate replace to="/tickets" />} />
    <Route path="/tickets" element={<Shell requester={requester} onChangeRequester={changeRequester}><h1 className="h3">My Tickets</h1><p className="text-secondary">Ticket listing will be added in the next issue.</p></Shell>} />
    <Route path="/tickets/new" element={<Shell requester={requester} onChangeRequester={changeRequester}><CreateTicket requester={requester} data={referenceData} /></Shell>} />
    <Route path="*" element={<Navigate replace to="/tickets" />} />
  </Routes>;
}
