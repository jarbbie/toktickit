import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { type CreatedTicket, type ReferenceData, type Requester, type TicketDetail, type TicketListResponse, type TicketQuery, attachmentDownloadUrl, createTicket, loadReferenceData, loadTicket, loadTickets, removeAttachment, uploadAttachment } from "./api.js";

type LoadState = "loading" | "ready" | "error";
type FormValues = { categoryId: string; relatedSystemId: string; requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; summary: string; description: string };
const requesterStorageKey = "toktickit.requesterId";

function priorityBadge(priority: string) {
  return <span className={`badge zen-badge zen-priority-${priority.toLowerCase()}`}>{priority}</span>;
}

function statusBadge(status: string) {
  return <span className={`badge zen-badge zen-status-${status.toLowerCase()}`}>{status}</span>;
}

function savedRequesterId() {
  const id = Number(sessionStorage.getItem(requesterStorageKey));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function Shell({ requester, onChangeRequester, children }: { requester: Requester; onChangeRequester: () => void; children: ReactNode }) {
  return (
    <main className="app-shell min-vh-100">
      <header className="app-header">
        <div className="container app-header-inner d-flex flex-wrap align-items-center gap-2">
          <strong className="app-brand"><svg aria-hidden="true" className="app-logo-mark" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /><path d="M16 7.5v8.5H8.5" /><path d="M10.5 6.2 13 4.8" /></svg>TokTickIT</strong>
          <nav className="d-flex align-items-center gap-1" aria-label="Main navigation">
            <NavLink end className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets"><span aria-hidden="true" className="nav-icon">▣</span>My Tickets</NavLink>
            <NavLink className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets/new"><span aria-hidden="true" className="nav-icon nav-icon-add">+</span>Create Ticket</NavLink>
          </nav>
          <details className="app-profile ms-md-auto">
            <summary><span aria-hidden="true" className="app-profile-mark" /><span>Profile: {requester.name}</span> <span aria-hidden="true">⌄</span></summary>
            <div className="app-profile-menu"><small>Testing requester</small><strong>{requester.name}</strong><button className="btn btn-sm btn-zen-primary w-100" onClick={onChangeRequester}>Change Requester</button></div>
          </details>
        </div>
      </header>
      <div className="container app-content py-5">{children}</div>
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
    <main className="container app-selector py-5">
      <header className="mb-4"><h1 className="h3 mb-1" style={{ color: "#006B3C" }}>TokTickIT</h1><p className="text-secondary mb-0">IT Service Desk</p></header>
      <section className="card shadow-sm"><div className="card-body">
        <h2 className="h4">Select Development Requester</h2>
        <p>This selector is for Lab 2 testing only. It is not a login screen.</p>
        <label className="form-label fw-semibold" htmlFor="requester">Development Requester</label>
        <select className="form-select mb-3" id="requester" value={pendingId ?? ""} onChange={(event) => setPendingId(Number(event.target.value) || null)}>
          <option value="">Choose a requester</option>
          {data.requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="btn btn-zen-primary" disabled={!pendingId} onClick={continueWithRequester}>Continue</button>
      </div></section>
    </main>
  );
}

const initialTicketFilters: TicketQuery = { search: "", categoryId: "", requestedPriority: "", status: "", sortBy: "updatedAt", direction: "desc", page: 1, pageSize: 10 };

function MyTickets({ requester, data }: { requester: Requester; data: ReferenceData }) {
  const [filters, setFilters] = useState<TicketQuery>(initialTicketFilters);
  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setFailure(false);
    void loadTickets(requester.id, filters).then((data) => {
      if (!cancelled) setResult(data);
    }).catch(() => {
      if (!cancelled) setFailure(true);
    });
    return () => { cancelled = true; };
  }, [requester.id, filters, retry]);

  function update<K extends keyof TicketQuery>(key: K, value: TicketQuery[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function changePage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  const hasFilters = Boolean(filters.search || filters.categoryId || filters.requestedPriority || filters.status);
  return <section>
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><h1 className="h3 mb-0">My Tickets</h1><NavLink className="btn btn-zen-primary" to="/tickets/new">Create Ticket</NavLink></div>
    <div className="card shadow-sm mb-4"><div className="card-body"><div className="row g-3">
      <div className="col-md-6"><label className="form-label" htmlFor="ticket-search">Search tickets</label><input className="form-control" id="ticket-search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Ticket number or summary" /></div>
      <div className="col-md-3"><label className="form-label" htmlFor="ticket-category">Category</label><select className="form-select" id="ticket-category" value={filters.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">All categories</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="col-md-3"><label className="form-label" htmlFor="ticket-priority">Requested Priority</label><select className="form-select" id="ticket-priority" value={filters.requestedPriority} onChange={(event) => update("requestedPriority", event.target.value as TicketQuery["requestedPriority"])}><option value="">All priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="col-md-3"><label className="form-label" htmlFor="ticket-status">Status</label><select className="form-select" id="ticket-status" value={filters.status} onChange={(event) => update("status", event.target.value as TicketQuery["status"])}><option value="">All statuses</option><option value="NEW">NEW</option></select></div>
      <div className="col-md-3"><label className="form-label" htmlFor="ticket-sort">Sort by</label><select className="form-select" id="ticket-sort" value={filters.sortBy} onChange={(event) => update("sortBy", event.target.value as TicketQuery["sortBy"])}><option value="updatedAt">Last Updated</option><option value="createdAt">Created</option><option value="ticketNumber">Ticket Number</option><option value="requestedPriority">Requested Priority</option></select></div>
      <div className="col-md-3"><label className="form-label" htmlFor="ticket-direction">Direction</label><select className="form-select" id="ticket-direction" value={filters.direction} onChange={(event) => update("direction", event.target.value as TicketQuery["direction"])}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></div>
      <div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-success w-100" onClick={() => setFilters(initialTicketFilters)}>Clear filters</button></div>
    </div></div></div>
    {!result && !failure && <p role="status">Loading tickets…</p>}
    {failure && <div className="alert alert-danger" role="alert">Unable to load tickets. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {result && result.items.length === 0 && <div className="alert alert-info" role="status">{hasFilters ? "No tickets match your filters." : "No tickets yet."}</div>}
    {result && result.items.length > 0 && <div className="table-responsive card shadow-sm"><table className="table table-hover mb-0"><thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Requested Priority</th><th>Status</th><th>Last Updated</th><th><span className="visually-hidden">Open</span></th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.id}><td>{ticket.ticketNumber}</td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{priorityBadge(ticket.requestedPriority)}</td><td>{statusBadge(ticket.status)}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td><td><NavLink className="btn btn-sm btn-outline-success" to={`/tickets/${ticket.id}`}>Open</NavLink></td></tr>)}</tbody></table></div>}
    {result && result.totalPages > 1 && <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Ticket pagination"><button className="btn btn-outline-success" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.totalPages}</span><button className="btn btn-outline-success" disabled={result.page === result.totalPages} onClick={() => changePage(result.page + 1)}>Next</button></nav>}
  </section>;
}

function TicketDetailPage({ requester, ticketId }: { requester: Requester; ticketId: number }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setFailure(false);
    void loadTicket(ticketId, requester.id).then((data) => { if (!cancelled) setTicket(data); }).catch(() => { if (!cancelled) setFailure(true); });
    return () => { cancelled = true; };
  }, [requester.id, retry, ticketId]);

  async function upload() {
    if (!file || !ticket) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError("Choose a JPG, PNG, WEBP, or PDF file no larger than 5 MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const attachment = await uploadAttachment(ticket.id, requester.id, file);
      setTicket({ ...ticket, attachments: [attachment, ...ticket.attachments] });
      setFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!removingId || !ticket) return;
    if (removalReason.trim().length < 1 || removalReason.trim().length > 500) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const updated = await removeAttachment(removingId, requester.id, removalReason);
      setTicket({ ...ticket, attachments: ticket.attachments.map((item) => item.id === updated.id ? updated : item) });
      setRemovingId(null);
      setRemovalReason("");
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Unable to remove attachment.");
    } finally {
      setRemoving(false);
    }
  }

  if (!ticket && !failure) return <p role="status">Loading ticket…</p>;
  if (failure) return <div className="alert alert-danger" role="alert">Unable to load ticket. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>;
  if (!ticket) return null;
  return <section>
    <div className="ticket-breadcrumb d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><nav aria-label="Breadcrumb"><NavLink to="/tickets">My Tickets</NavLink><span aria-hidden="true">›</span><span>Ticket Details</span></nav><NavLink className="btn btn-sm btn-outline-success back-link" to="/tickets"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M16 10H4m5-5-5 5 5 5" /></svg>Back to My Tickets</NavLink></div>
    <div className="card shadow-sm mb-3"><div className="card-body ticket-detail-card"><h1 className="visually-hidden">Ticket Details</h1><div className="row g-3">
      <DetailField label="Ticket No." value={ticket.ticketNumber} />
      <DetailField label="Ticket Date" value={new Date(ticket.createdAt).toLocaleString()} />
      <DetailField label="Category" value={ticket.category.name} />
      <DetailField label="Related System" value={ticket.relatedSystem.name} />
      <DetailField label="Requester" value={requester.name} />
      <DetailField label="Requested Priority" value={ticket.requestedPriority} />
      <DetailField label="Current Status" value={ticket.status} />
      <DetailField label="Last Updated" value={new Date(ticket.updatedAt).toLocaleString()} />
      <DetailField className="col-12" label="Summary" value={ticket.summary} />
      <DetailField className="col-12" label="Description" value={ticket.description} multiline />
    </div></div></div>
    <div className="card shadow-sm attachment-card"><div className="attachment-tabs" role="tablist" aria-label="Ticket sections"><button aria-controls="attachments-panel" aria-selected="true" className="attachment-tab" id="attachments-tab" role="tab" type="button"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7.2 10.9 5.4-5.4a3 3 0 1 1 4.2 4.2l-7.5 7.5a4.5 4.5 0 0 1-6.4-6.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5l-7 7a1 1 0 0 1-1.4-1.4l6.2-6.2" /></svg>Attachments <span className="badge zen-badge zen-badge-count">{ticket.attachments.length}</span></button></div><div aria-labelledby="attachments-tab" className="card-body attachment-panel" id="attachments-panel" role="tabpanel"><div className="mb-4"><label className="form-label" htmlFor="attachment-file">Add attachment</label><input className="form-control" id="attachment-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{uploadError && <div className="text-danger mt-1" role="alert">{uploadError}</div>}<button className="btn btn-zen-primary mt-2" disabled={!file || uploading} onClick={() => void upload()}>{uploading ? "Uploading…" : "Upload attachment"}</button></div>
      {ticket.attachments.length === 0 ? <p className="text-secondary mb-0">No attachments yet.</p> : <ul className="list-group">{ticket.attachments.map((attachment) => <li className="list-group-item" key={attachment.id}><div className="d-flex flex-wrap gap-2 align-items-center"><span className="me-auto text-break">{attachment.originalName} ({Math.ceil(attachment.sizeBytes / 1024)} KB)</span>{attachment.removedAt ? <span className="badge zen-badge zen-badge-removed">Removed</span> : <><a className="btn btn-sm btn-outline-success" href={attachmentDownloadUrl(attachment.id, requester.id)}>Download</a><button className="btn btn-sm btn-outline-danger" onClick={() => setRemovingId(attachment.id)}>Remove</button></>}</div>{attachment.removedAt && <small className="text-secondary">Reason: {attachment.removalReason}</small>}{removingId === attachment.id && <div className="mt-2"><label className="form-label" htmlFor="removal-reason">Removal reason</label><input className="form-control" id="removal-reason" maxLength={500} value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} />{removeError && <div className="text-danger mt-1" role="alert">{removeError}</div>}<button className="btn btn-danger btn-sm mt-2 me-2" disabled={removing || removalReason.trim().length === 0} onClick={() => void remove()}>{removing ? "Removing…" : "Confirm removal"}</button><button className="btn btn-outline-secondary btn-sm mt-2" disabled={removing} onClick={() => setRemovingId(null)}>Cancel</button></div>}</li>)}</ul>}
    </div></div>
  </section>;
}

function DetailField({ label, value, className = "col-md-3", multiline = false }: { label: string; value: string; className?: string; multiline?: boolean }) {
  return <div className={className}><div className="form-label">{label}</div>{multiline ? <div className="readonly-field ticket-detail-value">{value}</div> : <input aria-label={label} className="form-control readonly-field" readOnly value={value} />}</div>;
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

  if (created) return <section className="card shadow-sm"><div className="card-body"><h1 className="h3">Ticket created: {created.ticketNumber}</h1><p>Your ticket is saved with status New.</p><NavLink className="btn btn-zen-primary" to="/tickets">View My Tickets</NavLink></div></section>;

  const invalid = (name: string) => errors[name] ? "form-control is-invalid" : "form-control";
  const invalidSelect = (name: string) => errors[name] ? "form-select is-invalid" : "form-select";
  return (
    <section className="card shadow-sm"><div className="card-body">
      <h1 className="h3 mb-4">Create Ticket</h1>
      {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
      <form noValidate onSubmit={submit}>
        <div className="row g-3 mb-3">
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-requester">Requester</label><input className="form-control readonly-field" id="ticket-requester" readOnly value={requester.name} /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-date">Ticket Date</label><input className="form-control readonly-field" id="ticket-date" readOnly value="Generated on submission" /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="ticket-number">Ticket Number</label><input className="form-control readonly-field" id="ticket-number" readOnly value="Generated after submission" /></div>
        </div>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="category">Category <span className="text-danger">*</span></label><select className={invalidSelect("categoryId")} id="category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">Choose a category</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.categoryId && <div className="invalid-feedback">{errors.categoryId}</div>}</div>
          <div className="col-md-6"><label className="form-label" htmlFor="related-system">Related System <span className="text-danger">*</span></label><select className={invalidSelect("relatedSystemId")} id="related-system" value={form.relatedSystemId} onChange={(event) => update("relatedSystemId", event.target.value)}><option value="">Choose a related system</option>{data.relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.relatedSystemId && <div className="invalid-feedback">{errors.relatedSystemId}</div>}</div>
          <div className="col-md-6"><label className="form-label" htmlFor="requested-priority">Requested Priority <span className="text-danger">*</span></label><select className="form-select" id="requested-priority" value={form.requestedPriority} onChange={(event) => update("requestedPriority", event.target.value as FormValues["requestedPriority"])}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority}>{priority}</option>)}</select></div>
          <div className="col-12"><label className="form-label" htmlFor="summary">Ticket Summary <span className="text-danger">*</span></label><input className={invalid("summary")} id="summary" value={form.summary} onChange={(event) => update("summary", event.target.value)} />{errors.summary && <div className="invalid-feedback">{errors.summary}</div>}</div>
          <div className="col-12"><label className="form-label" htmlFor="description">Description <span className={"text-danger"}>*</span></label><textarea className={invalid("description")} id="description" rows={5} value={form.description} onChange={(event) => update("description", event.target.value)} />{errors.description && <div className="invalid-feedback">{errors.description}</div>}</div>
        </div>
        <button className="btn btn-zen-primary mt-4" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit Ticket"}</button>
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
    <Route path="/tickets" element={<Shell requester={requester} onChangeRequester={changeRequester}><MyTickets requester={requester} data={referenceData} /></Shell>} />
    <Route path="/tickets/new" element={<Shell requester={requester} onChangeRequester={changeRequester}><CreateTicket requester={requester} data={referenceData} /></Shell>} />
    <Route path="/tickets/:ticketId" element={<Shell requester={requester} onChangeRequester={changeRequester}><TicketRoute requester={requester} /></Shell>} />
    <Route path="*" element={<Navigate replace to="/tickets" />} />
  </Routes>;
}

function TicketRoute({ requester }: { requester: Requester }) {
  const ticketId = Number(useParams().ticketId);
  return Number.isInteger(ticketId) && ticketId > 0 ? <TicketDetailPage requester={requester} ticketId={ticketId} /> : <Navigate replace to="/tickets" />;
}
