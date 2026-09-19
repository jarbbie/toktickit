import { Fragment, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { type CreatedTicket, type ReferenceData, type Requester, type TicketDetail, type TicketListResponse, type TicketQuery, attachmentDownloadUrl, createTicket, loadReferenceData, loadTicket, loadTickets, removeAttachment, uploadAttachment } from "./api.js";

type LoadState = "loading" | "ready" | "error";
type FormValues = { categoryId: string; relatedSystemId: string; requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; summary: string; description: string };
const requesterStorageKey = "toktickit.requesterId";
const attachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function attachmentValidationError(file: File) {
  if (!attachmentTypes.includes(file.type)) return "Choose a JPG, PNG, WEBP, or PDF file.";
  if (file.size > 5 * 1024 * 1024) return "Attachment must be no larger than 5 MB.";
  return "";
}

function enumLabel(value: string) {
  return value[0] + value.slice(1).toLowerCase();
}

function priorityBadge(priority: string) {
  return <span className={`badge zen-badge zen-priority-${priority.toLowerCase()}`}>{enumLabel(priority)}</span>;
}

function statusBadge(status: string) {
  return <span className={`badge zen-badge zen-status-${status.toLowerCase()}`}>{enumLabel(status)}</span>;
}

function savedRequesterId() {
  const id = Number(sessionStorage.getItem(requesterStorageKey));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function AppHeader({ requester, onChangeRequester }: { requester?: Requester; onChangeRequester?: () => void }) {
  return <header className="app-header"><div className="container app-header-inner d-flex flex-wrap align-items-center gap-2">
    <strong className="app-brand"><svg aria-hidden="true" className="app-logo-mark" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /><path d="M16 7.5v8.5H8.5" /><path d="M10.5 6.2 13 4.8" /></svg>TokTickIT</strong>
    <nav className="app-main-nav d-flex align-items-center gap-1" aria-label="Main navigation">
      <NavLink end className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets"><svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20"><path d="M5 2.5h7l3 3v12H5Z" /><path d="M12 2.5v3h3M7.5 9h5M7.5 12h5" /></svg>My Tickets</NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets/new"><span aria-hidden="true" className="nav-icon nav-icon-add">+</span>Create Ticket</NavLink>
    </nav>
    {requester && onChangeRequester ? <details className="app-profile ms-md-auto">
      <summary><span aria-hidden="true" className="app-profile-mark" /><span>Profile: {requester.name}</span> <span aria-hidden="true">⌄</span></summary>
      <div className="app-profile-menu"><small>Testing requester</small><strong>{requester.name}</strong><button className="btn btn-sm btn-zen-primary w-100" onClick={onChangeRequester}>Change Requester</button></div>
    </details> : <span className="app-profile app-profile-static ms-md-auto"><span aria-hidden="true" className="app-profile-mark" />Profile <span aria-hidden="true">⌄</span></span>}
  </div></header>;
}

function Shell({ requester, onChangeRequester, children, wide = false }: { requester: Requester; onChangeRequester: () => void; children: ReactNode; wide?: boolean }) {
  return <main className="app-shell min-vh-100"><AppHeader requester={requester} onChangeRequester={onChangeRequester} /><div className={`container app-content${wide ? " app-content-wide" : ""} py-5`}>{children}</div></main>;
}

function RequesterSelector({ data, onSelected }: { data: ReferenceData; onSelected: (id: number) => void }) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const navigate = useNavigate();

  if (data.requesters.length === 0) return <main className="app-shell min-vh-100"><AppHeader /><div className="container app-content py-5"><div className="alert alert-warning" role="status">No active Development Requesters are available.</div></div></main>;

  function continueWithRequester() {
    if (!pendingId) return;
    onSelected(pendingId);
    navigate("/tickets");
  }

  return <main className="app-shell min-vh-100">
    <AppHeader />
    <div className="container app-content selector-page py-4">
      <nav className="selector-breadcrumb" aria-label="Breadcrumb"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m3 9 7-6 7 6v8h-5v-5H8v5H3Z" /></svg><span aria-hidden="true">›</span><strong>Development Requester Selection</strong></nav>
      <section className="card requester-card mx-auto mt-4">
        <div className="card-body requester-card-body">
          <header className="requester-card-intro text-center">
            <div className="requester-selector-icon" aria-hidden="true"><svg viewBox="0 0 28 28"><circle cx="12" cy="8" r="4" /><path d="M4.5 22v-3.2c0-3.2 3.4-5.8 7.5-5.8s7.5 2.6 7.5 5.8V22" /><path d="M21 15v6m-3-3h6" /></svg></div>
            <h1 className="h3 mb-2">Select Development Requester</h1>
            <p className="text-secondary mb-0">Choose a development requester to simulate the current requester context for Lab 2.</p>
            <p className="text-secondary">This is for testing only and is not a login screen.</p>
          </header>
          <hr />
          <div className="requester-form">
            <label className="form-label" htmlFor="requester">Development Requester <span className="text-danger">*</span></label>
            <select className="form-select" id="requester" value={pendingId ?? ""} onChange={(event) => setPendingId(Number(event.target.value) || null)}>
              <option value="">Choose a requester</option>
              {data.requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="selector-notice selector-notice-info"><svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /><path d="M10 8v6M10 5.5v.2" /></svg><span>Only active development requesters are shown.</span></div>
            <div className="selector-notice selector-notice-auth"><span aria-hidden="true" className="selector-shield"><svg viewBox="0 0 20 20"><path d="M10 2.5 16 5v4.5c0 3.8-2.5 6.5-6 8-3.5-1.5-6-4.2-6-8V5Z" /></svg></span><span><strong>Authentication coming in Lab 3</strong><small>In Lab 3, this selector will be replaced with secure authentication so you can access the system with your own account.</small></span></div>
          </div>
        </div>
        <footer className="card-footer requester-card-footer"><button className="btn btn-outline-secondary" type="button" onClick={() => setPendingId(null)}>Cancel</button><button className="btn btn-zen-primary" disabled={!pendingId} onClick={continueWithRequester}>Continue <span aria-hidden="true">→</span></button></footer>
      </section>
    </div>
  </main>;
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

  function changeSort(sortBy: TicketQuery["sortBy"]) {
    setFilters((current) => ({ ...current, sortBy, direction: current.sortBy === sortBy && current.direction === "asc" ? "desc" : "asc", page: 1 }));
  }

  function sortMark(sortBy: TicketQuery["sortBy"]) {
    return filters.sortBy === sortBy ? filters.direction === "asc" ? "↑" : "↓" : "↕";
  }

  const hasFilters = Boolean(filters.search || filters.categoryId || filters.requestedPriority || filters.status);
  const firstItem = result && result.items.length > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastItem = result ? Math.min(result.page * result.pageSize, result.totalItems) : 0;
  const visiblePages = result ? Array.from({ length: result.totalPages }, (_, index) => index + 1).filter((page) => result.totalPages <= 7 || page === 1 || page === result.totalPages || result.page <= 3 && page <= 5 || result.page >= result.totalPages - 2 && page >= result.totalPages - 4 || Math.abs(page - result.page) <= 1) : [];
  return <section className="my-tickets-page">
    <header className="ticket-list-heading d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4"><div><h1 className="h3 mb-1">My Tickets</h1><p className="text-secondary mb-0">View and track all of your support requests.</p></div><div className="d-flex gap-2"><button className="btn btn-outline-secondary" onClick={() => setFilters(initialTicketFilters)}><span aria-hidden="true">↻</span> Clear Filters</button><NavLink className="btn btn-zen-primary" to="/tickets/new"><span aria-hidden="true">+</span> Create Ticket</NavLink></div></header>
    <div className="card ticket-filter-card mb-4"><div className="card-body ticket-filter-grid">
      <div className="ticket-filter-search"><label className="form-label" htmlFor="ticket-search">Search tickets</label><div className="search-control"><svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg><input className="form-control" id="ticket-search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Ticket number or summary" /></div></div>
      <div><label className="form-label" htmlFor="ticket-category">Category</label><select className="form-select" id="ticket-category" value={filters.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">All categories</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label className="form-label" htmlFor="ticket-priority">Requested Priority</label><select className="form-select" id="ticket-priority" value={filters.requestedPriority} onChange={(event) => update("requestedPriority", event.target.value as TicketQuery["requestedPriority"])}><option value="">All priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div><label className="form-label" htmlFor="ticket-status">Current Status</label><select className="form-select" id="ticket-status" value={filters.status} onChange={(event) => update("status", event.target.value as TicketQuery["status"])}><option value="">All statuses</option><option value="NEW">NEW</option></select></div>
    </div></div>
    {!result && !failure && <p role="status">Loading tickets…</p>}
    {failure && <div className="alert alert-danger" role="alert">Unable to load tickets. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {result && result.items.length === 0 && <div className="alert alert-info" role="status">{hasFilters ? "No tickets match your filters." : "No tickets yet."}</div>}
    {result && result.items.length > 0 && <div className="card ticket-table-card"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th><button aria-label={`Sort by Ticket Number ${filters.sortBy === "ticketNumber" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("ticketNumber")}>Ticket No. <span aria-hidden="true">{sortMark("ticketNumber")}</span></button></th><th><button aria-label={`Sort by Created Date ${filters.sortBy === "createdAt" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("createdAt")}>Created Date <span aria-hidden="true">{sortMark("createdAt")}</span></button></th><th>Summary</th><th>Category</th><th>Requested Priority</th><th>Current Status</th><th><button aria-label={`Sort by Last Updated ${filters.sortBy === "updatedAt" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("updatedAt")}>Last Updated <span aria-hidden="true">{sortMark("updatedAt")}</span></button></th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.id}><td><NavLink className="ticket-number-link" to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</NavLink></td><td>{new Date(ticket.createdAt).toLocaleString()}</td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{priorityBadge(ticket.requestedPriority)}</td><td>{statusBadge(ticket.status)}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div><footer className="ticket-table-footer"><span>Showing {firstItem} to {lastItem} of {result.totalItems} tickets</span>{result.totalPages > 1 && <nav className="ticket-pagination" aria-label="Ticket pagination"><button className="btn btn-sm btn-outline-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>‹ Previous</button>{visiblePages.map((page, index) => <Fragment key={page}>{index > 0 && page - visiblePages[index - 1] > 1 && <span aria-hidden="true" className="page-ellipsis">…</span>}<button aria-current={page === result.page ? "page" : undefined} aria-label={`Page ${page}`} className={`btn btn-sm page-number${page === result.page ? " current-page" : " btn-outline-secondary"}`} onClick={() => changePage(page)}>{page}</button></Fragment>)}<button className="btn btn-sm btn-outline-secondary" disabled={result.page === result.totalPages} onClick={() => changePage(result.page + 1)}>Next ›</button></nav>}</footer></div>}
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
    const validationError = attachmentValidationError(file);
    if (validationError) {
      setUploadError(validationError);
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
  const [file, setFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentWarning, setAttachmentWarning] = useState("");

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
    if (file) next.attachment = attachmentValidationError(file);
    if (!next.attachment) delete next.attachment;
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
      const ticket = await createTicket({ requesterId: requester.id, categoryId: Number(form.categoryId), relatedSystemId: Number(form.relatedSystemId), requestedPriority: form.requestedPriority, summary: form.summary, description: form.description });
      if (file) {
        try {
          await uploadAttachment(ticket.id, requester.id, file);
        } catch (error) {
          setAttachmentWarning(error instanceof Error ? error.message : "Unable to upload attachment.");
        }
      }
      setCreated(ticket);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unable to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <section className="card shadow-sm"><div className="card-body"><h1 className="h3">Ticket created: {created.ticketNumber}</h1><p>Your ticket is saved with status New.</p>{attachmentWarning && <div className="alert alert-warning" role="alert">Ticket created, but the attachment could not be uploaded: {attachmentWarning}</div>}<div className="d-flex flex-wrap gap-2"><NavLink className="btn btn-zen-primary" to="/tickets">View My Tickets</NavLink><NavLink className="btn btn-outline-success" to={`/tickets/${created.id}`}>View Ticket Details</NavLink></div></div></section>;

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
          <div className="col-12"><label className="form-label" htmlFor="create-attachment">Attachment <span className="text-secondary">(optional)</span></label><input accept={attachmentTypes.join(",")} className={`form-control${attachmentError || errors.attachment ? " is-invalid" : ""}`} id="create-attachment" type="file" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setFile(selected); setAttachmentError(selected ? attachmentValidationError(selected) : ""); setErrors((current) => ({ ...current, attachment: "" })); }} />{(attachmentError || errors.attachment) && <div className="invalid-feedback">{attachmentError || errors.attachment}</div>}<div className="form-text">JPG, PNG, WEBP, or PDF; maximum 5 MB. More files can be added from Ticket Details.</div></div>
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
    <Route path="/tickets" element={<Shell requester={requester} onChangeRequester={changeRequester} wide><MyTickets requester={requester} data={referenceData} /></Shell>} />
    <Route path="/tickets/new" element={<Shell requester={requester} onChangeRequester={changeRequester}><CreateTicket requester={requester} data={referenceData} /></Shell>} />
    <Route path="/tickets/:ticketId" element={<Shell requester={requester} onChangeRequester={changeRequester}><TicketRoute requester={requester} /></Shell>} />
    <Route path="*" element={<Navigate replace to="/tickets" />} />
  </Routes>;
}

function TicketRoute({ requester }: { requester: Requester }) {
  const ticketId = Number(useParams().ticketId);
  return Number.isInteger(ticketId) && ticketId > 0 ? <TicketDetailPage requester={requester} ticketId={ticketId} /> : <Navigate replace to="/tickets" />;
}
