import { Fragment, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ApiError, type AuthResult, type AuthUser, type CreatedTicket, type PublicComment, type ReferenceData, type Requester, type TicketDetail, type TicketListResponse, type TicketQuery, addPublicComment, attachmentDownloadUrl, changePassword, createTicket, currentUser, indicateResolution, loadPublicComments, loadReferenceData, loadTicket, loadTickets, login, logout, removeAttachment, uploadAttachment } from "./api.js";
import StaffQueue from "./StaffQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import UserManagement from "./UserManagement.js";

type SessionState = "checking" | "guest" | "ready" | "error";
type FormValues = { categoryId: string; relatedSystemId: string; requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; summary: string; description: string };
const attachmentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function attachmentValidationError(file: File) {
  if (!attachmentTypes.includes(file.type)) return "Choose a JPG, PNG, WEBP, or PDF file.";
  if (file.size > 5 * 1024 * 1024) return "Attachment must be no larger than 5 MB.";
  return "";
}

function enumLabel(value: string) {
  if (value === "WAITING_FOR_REQUESTER") return "Waiting for Requester";
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function priorityBadge(priority: string) {
  return <span className={`badge zen-badge zen-priority-${priority.toLowerCase()}`}>{enumLabel(priority)}</span>;
}

function statusBadge(status: string) {
  return <span className={`badge zen-badge zen-status-${status.toLowerCase().replaceAll("_", "-")}`}>{enumLabel(status)}</span>;
}

function roleLabel(role: AuthUser["role"]) {
  return role === "IT_STAFF" ? "IT Staff" : role === "ADMINISTRATOR" ? "Administrator" : "Requester";
}

function roleHome(user: AuthUser) {
  return user.role === "REQUESTER" ? "/tickets" : user.role === "IT_STAFF" ? "/staff/tickets" : "/admin/users";
}

function AppHeader({ user, onLogout, logoutError }: { user: AuthUser; onLogout: () => void; logoutError: string }) {
  return <header className="app-header"><div className="container app-header-inner d-flex flex-wrap align-items-center gap-2">
    <strong className="app-brand"><svg aria-hidden="true" className="app-logo-mark" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /><path d="M16 7.5v8.5H8.5" /><path d="M10.5 6.2 13 4.8" /></svg>TokTickIT</strong>
    <nav className="app-main-nav d-flex align-items-center gap-1" aria-label="Main navigation">
      {user.role === "REQUESTER" && <><NavLink end className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets"><svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20"><path d="M5 2.5h7l3 3v12H5Z" /><path d="M12 2.5v3h3M7.5 9h5M7.5 12h5" /></svg>My Tickets</NavLink>
      <NavLink className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/tickets/new"><span aria-hidden="true" className="nav-icon nav-icon-add">+</span>Create Ticket</NavLink></>}
      {user.role !== "REQUESTER" && <NavLink className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/staff/tickets"><svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20"><path d="M3 4.5h14v11H3ZM6 8h8M6 11h5" /></svg>Ticket Queue</NavLink>}
      {user.role === "ADMINISTRATOR" && <NavLink className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`} to="/admin/users"><svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20"><circle cx="10" cy="6" r="3" /><path d="M4 17c.5-3 2.5-5 6-5s5.5 2 6 5" /></svg>User Management</NavLink>}
    </nav>
    <details className="app-profile ms-md-auto">
      <summary><span aria-hidden="true" className="app-profile-mark" /><span>{user.name}</span><span className="zen-role-badge">{roleLabel(user.role)}</span> <span aria-hidden="true">⌄</span></summary>
      <div className="app-profile-menu"><strong>{user.name}</strong><small>{user.email}</small><span className="zen-role-badge role-menu-badge">{roleLabel(user.role)}</span><NavLink className="btn btn-sm btn-outline-success w-100" to="/change-password">Change Password</NavLink><button className="btn btn-sm btn-zen-primary w-100" onClick={onLogout}>Logout</button>{logoutError && <div role="alert" className="text-danger small">{logoutError}</div>}</div>
    </details>
  </div></header>;
}

function Shell({ user, onLogout, logoutError, children, wide = false }: { user: AuthUser; onLogout: () => void; logoutError: string; children: ReactNode; wide?: boolean }) {
  return <main className="app-shell min-vh-100"><AppHeader user={user} onLogout={onLogout} logoutError={logoutError} /><div className={`container app-content${wide ? " app-content-wide" : ""} py-5`}>{children}</div></main>;
}

const initialTicketFilters: TicketQuery = { search: "", categoryId: "", requestedPriority: "", status: "", sortBy: "updatedAt", direction: "desc", page: 1, pageSize: 10 };

function MyTickets({ data }: { data: ReferenceData }) {
  const [filters, setFilters] = useState<TicketQuery>(initialTicketFilters);
  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setFailure(false);
    void loadTickets(filters).then((data) => {
      if (!cancelled) setResult(data);
    }).catch(() => {
      if (!cancelled) setFailure(true);
    });
    return () => { cancelled = true; };
  }, [filters, retry]);

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
      <div><label className="form-label" htmlFor="ticket-status">Current Status</label><select className="form-select" id="ticket-status" value={filters.status} onChange={(event) => update("status", event.target.value as TicketQuery["status"])}><option value="">All statuses</option>{["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></div>
    </div></div>
    {!result && !failure && <p role="status">Loading tickets…</p>}
    {failure && <div className="alert alert-danger" role="alert">Unable to load tickets. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {result && result.items.length === 0 && <div className="alert alert-info" role="status">{hasFilters ? "No tickets match your filters." : "No tickets yet."}</div>}
    {result && result.items.length > 0 && <div className="card ticket-table-card"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th><button aria-label={`Sort by Ticket Number ${filters.sortBy === "ticketNumber" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("ticketNumber")}>Ticket No. <span aria-hidden="true">{sortMark("ticketNumber")}</span></button></th><th><button aria-label={`Sort by Created Date ${filters.sortBy === "createdAt" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("createdAt")}>Created Date <span aria-hidden="true">{sortMark("createdAt")}</span></button></th><th>Summary</th><th>Category</th><th>Requested Priority</th><th>IT Priority</th><th>Current Status</th><th><button aria-label={`Sort by Last Updated ${filters.sortBy === "updatedAt" ? filters.direction : ""}`} className="table-sort" onClick={() => changeSort("updatedAt")}>Last Updated <span aria-hidden="true">{sortMark("updatedAt")}</span></button></th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.id}><td><NavLink className="ticket-number-link" to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</NavLink></td><td>{new Date(ticket.createdAt).toLocaleString()}</td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{priorityBadge(ticket.requestedPriority)}</td><td>{priorityBadge(ticket.itPriority)}</td><td>{statusBadge(ticket.status)}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div><footer className="ticket-table-footer"><span>Showing {firstItem} to {lastItem} of {result.totalItems} tickets</span>{result.totalPages > 1 && <nav className="ticket-pagination" aria-label="Ticket pagination"><button className="btn btn-sm btn-outline-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>‹ Previous</button>{visiblePages.map((page, index) => <Fragment key={page}>{index > 0 && page - visiblePages[index - 1] > 1 && <span aria-hidden="true" className="page-ellipsis">…</span>}<button aria-current={page === result.page ? "page" : undefined} aria-label={`Page ${page}`} className={`btn btn-sm page-number${page === result.page ? " current-page" : " btn-outline-secondary"}`} onClick={() => changePage(page)}>{page}</button></Fragment>)}<button className="btn btn-sm btn-outline-secondary" disabled={result.page === result.totalPages} onClick={() => changePage(result.page + 1)}>Next ›</button></nav>}</footer></div>}
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
  const [comments, setComments] = useState<PublicComment[] | null>(null);
  const [commentsFailure, setCommentsFailure] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setFailure(false);
    setComments(null);
    setCommentsFailure(false);
    void loadTicket(ticketId).then((data) => { if (!cancelled) setTicket(data); }).catch(() => { if (!cancelled) setFailure(true); });
    void loadPublicComments(ticketId).then((data) => { if (!cancelled) setComments(data); }).catch(() => { if (!cancelled) setCommentsFailure(true); });
    return () => { cancelled = true; };
  }, [retry, ticketId]);

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
      const attachment = await uploadAttachment(ticket.id, file);
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
      const updated = await removeAttachment(removingId, removalReason);
      setTicket({ ...ticket, attachments: ticket.attachments.map((item) => item.id === updated.id ? updated : item) });
      setRemovingId(null);
      setRemovalReason("");
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Unable to remove attachment.");
    } finally {
      setRemoving(false);
    }
  }

  async function postComment(event: FormEvent) {
    event.preventDefault();
    if (!ticket) return;
    const body = commentBody.trim();
    if (body.length < 1 || body.length > 2_000 || commentSubmitting) {
      setCommentError("Comment must be between 1 and 2000 characters.");
      return;
    }
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const created = await addPublicComment(ticket.id, body);
      setComments((current) => [...(current ?? []), created]);
      setCommentBody("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Unable to add public comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function indicateProblemResolved() {
    if (!ticket || resolutionSubmitting) return;
    setResolutionSubmitting(true);
    setResolutionError("");
    try {
      const result = await indicateResolution(ticket.id);
      setTicket({ ...ticket, resolutionIndicatedAt: result.resolutionIndicatedAt, updatedAt: result.updatedAt });
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : "Unable to record the resolution indication.");
    } finally {
      setResolutionSubmitting(false);
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
      <DetailField label="Requester" value={ticket.requester?.name ?? requester.name} />
      <DetailField label="Requested Priority" value={ticket.requestedPriority} />
      <DetailField label="IT Priority" value={ticket.itPriority} />
      <DetailField label="Current Status" value={ticket.status} />
      <DetailField label="Last Updated" value={new Date(ticket.updatedAt).toLocaleString()} />
      <DetailField className="col-12" label="Summary" value={ticket.summary} />
      <DetailField className="col-12" label="Description" value={ticket.description} multiline />
    </div></div></div>
    <div className="card shadow-sm mb-3 public-comments-card"><div className="card-body"><div className="d-flex align-items-center gap-2 mb-3"><h2 className="h5 mb-0">Public Comments</h2><span className="badge zen-badge zen-badge-count">{comments?.length ?? 0}</span></div>{!comments && !commentsFailure && <p role="status">Loading comments…</p>}{commentsFailure && <div className="alert alert-danger" role="alert">Unable to load public comments. <button className="btn btn-sm btn-danger ms-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}{comments && comments.length === 0 && <p className="text-secondary">No public comments yet.</p>}{comments && comments.length > 0 && <ul className="list-group mb-3">{comments.map((comment) => <li className="list-group-item" key={comment.id}><div className="d-flex justify-content-between gap-2"><strong>{comment.author.name}</strong><small className="text-secondary">{new Date(comment.createdAt).toLocaleString()}</small></div><p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p></li>)}</ul>}<form onSubmit={postComment}><label className="form-label" htmlFor="public-comment">Add public comment</label><textarea className="form-control" id="public-comment" rows={3} maxLength={2_000} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />{commentError && <div className="text-danger mt-1" role="alert">{commentError}</div>}<button className="btn btn-zen-primary mt-2" disabled={commentSubmitting} type="submit">{commentSubmitting ? "Posting…" : "Post Comment"}</button></form></div></div>
    <div className="card shadow-sm mb-3"><div className="card-body d-flex flex-wrap align-items-center gap-2"><div className="me-auto"><strong>Problem appears resolved?</strong>{ticket.resolutionIndicatedAt && <p className="text-secondary mb-0">Indicated on {new Date(ticket.resolutionIndicatedAt).toLocaleString()}. Current status remains {enumLabel(ticket.status)}.</p>}</div>{!ticket.resolutionIndicatedAt && ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.status) && <button className="btn btn-outline-success" disabled={resolutionSubmitting} onClick={() => void indicateProblemResolved()}>{resolutionSubmitting ? "Saving…" : "Problem appears resolved"}</button>}{resolutionError && <div className="text-danger w-100" role="alert">{resolutionError}</div>}</div></div>
    <div className="card shadow-sm attachment-card"><div className="attachment-tabs" role="tablist" aria-label="Ticket sections"><button aria-controls="attachments-panel" aria-selected="true" className="attachment-tab" id="attachments-tab" role="tab" type="button"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7.2 10.9 5.4-5.4a3 3 0 1 1 4.2 4.2l-7.5 7.5a4.5 4.5 0 0 1-6.4-6.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5l-7 7a1 1 0 0 1-1.4-1.4l6.2-6.2" /></svg>Attachments <span className="badge zen-badge zen-badge-count">{ticket.attachments.length}</span></button></div><div aria-labelledby="attachments-tab" className="card-body attachment-panel" id="attachments-panel" role="tabpanel"><div className="mb-4"><label className="form-label" htmlFor="attachment-file">Add attachment</label><input className="form-control" id="attachment-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{uploadError && <div className="text-danger mt-1" role="alert">{uploadError}</div>}<button className="btn btn-zen-primary mt-2" disabled={!file || uploading} onClick={() => void upload()}>{uploading ? "Uploading…" : "Upload attachment"}</button></div>
      {ticket.attachments.length === 0 ? <p className="text-secondary mb-0">No attachments yet.</p> : <ul className="list-group">{ticket.attachments.map((attachment) => <li className="list-group-item" key={attachment.id}><div className="d-flex flex-wrap gap-2 align-items-center"><span className="me-auto text-break">{attachment.originalName} ({Math.ceil(attachment.sizeBytes / 1024)} KB)</span>{attachment.removedAt ? <span className="badge zen-badge zen-badge-removed">Removed</span> : <><a className="btn btn-sm btn-outline-success" href={attachmentDownloadUrl(attachment.id)}>Download</a><button className="btn btn-sm btn-outline-danger" onClick={() => setRemovingId(attachment.id)}>Remove</button></>}</div>{attachment.removedAt && <small className="text-secondary">Reason: {attachment.removalReason}</small>}{removingId === attachment.id && <div className="mt-2"><label className="form-label" htmlFor="removal-reason">Removal reason</label><input className="form-control" id="removal-reason" maxLength={500} value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} />{removeError && <div className="text-danger mt-1" role="alert">{removeError}</div>}<button className="btn btn-danger btn-sm mt-2 me-2" disabled={removing || removalReason.trim().length === 0} onClick={() => void remove()}>{removing ? "Removing…" : "Confirm removal"}</button><button className="btn btn-outline-secondary btn-sm mt-2" disabled={removing} onClick={() => setRemovingId(null)}>Cancel</button></div>}</li>)}</ul>}
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
      const ticket = await createTicket({ categoryId: Number(form.categoryId), relatedSystemId: Number(form.relatedSystemId), requestedPriority: form.requestedPriority, summary: form.summary, description: form.description });
      if (file) {
        try {
          await uploadAttachment(ticket.id, file);
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

function Login({ onAuthenticated }: { onAuthenticated: (result: AuthResult) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (password.length < 12 || password.length > 128) nextErrors.password = "Password must be between 12 and 128 characters.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true); setError("");
    try {
      const result = await login(email, password);
      setPassword("");
      onAuthenticated(result);
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : null;
      setFieldErrors(apiError?.fieldErrors ?? {});
      setError(apiError?.status === 429 && apiError.retryAfter
        ? `Too many sign-in attempts. Try again in ${apiError.retryAfter} seconds.`
        : apiError?.status === 401 ? "Unable to sign in. Check your credentials or contact an administrator."
          : apiError?.message ?? "Unable to sign in right now. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page min-vh-100"><section className="card auth-card shadow-sm"><div className="card-body p-4 p-md-5"><div className="text-center mb-4"><strong className="auth-brand">TokTickIT</strong><h1 className="h3 mt-3 mb-1">Sign in</h1><p className="text-secondary mb-0">Use your TokTickIT account to continue.</p></div>{error && <div className="alert alert-danger" role="alert">{error}</div>}<form noValidate onSubmit={submit}>
    <div className="mb-3"><label className="form-label" htmlFor="login-email">Email</label><input autoComplete="username" className={`form-control${fieldErrors.email ? " is-invalid" : ""}`} id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} />{fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}</div>
    <div className="mb-4"><label className="form-label" htmlFor="login-password">Password</label><div className="input-group"><input autoComplete="current-password" className={`form-control${fieldErrors.password ? " is-invalid" : ""}`} id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="btn btn-outline-secondary" type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Hide" : "Show"}</button></div>{fieldErrors.password && <div className="invalid-feedback d-block">{fieldErrors.password}</div>}</div>
    <button className="btn btn-zen-primary w-100" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
  </form></div></section></main>;
}

function ChangePassword({ user, mandatory, onChanged, onLogout }: { user: AuthUser; mandatory: boolean; onChanged: (result: AuthResult) => void; onLogout: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (currentPassword.length < 12 || currentPassword.length > 128) nextErrors.currentPassword = "Password must be between 12 and 128 characters.";
    if (newPassword.length < 12 || newPassword.length > 128) nextErrors.newPassword = "Password must be between 12 and 128 characters.";
    if (newPassword === currentPassword && newPassword.length >= 12 && newPassword.length <= 128) nextErrors.newPassword = "Your new password must differ from your current password.";
    if (newPassword !== confirmation) nextErrors.confirmation = "Passwords must match exactly.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true); setError("");
    try {
      const result = await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      onChanged(result);
      navigate(roleHome(result.user), { replace: true });
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : null;
      setFieldErrors(apiError?.fieldErrors ?? {});
      setError(apiError?.message ?? "Unable to change password right now. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page min-vh-100"><section className="card auth-card shadow-sm"><div className="card-body p-4 p-md-5"><div className="text-center mb-4"><strong className="auth-brand">TokTickIT</strong><h1 className="h3 mt-3 mb-1">{mandatory ? "Change your initial password to continue" : "Change Password"}</h1><p className="text-secondary mb-0">Signed in as {user.name} ({roleLabel(user.role)})</p></div>{error && <div className="alert alert-danger" role="alert">{error}</div>}<p className="form-text">Use 12–128 characters. Your new password must differ from your current password. Spaces are part of your password.</p><form noValidate onSubmit={submit}>
    <PasswordInput id="current-password" label="Current Password" value={currentPassword} onChange={setCurrentPassword} error={fieldErrors.currentPassword} autoComplete="current-password" />
    <PasswordInput id="new-password" label="New Password" value={newPassword} onChange={setNewPassword} error={fieldErrors.newPassword} autoComplete="new-password" />
    <PasswordInput id="confirm-password" label="Confirm New Password" value={confirmation} onChange={setConfirmation} error={fieldErrors.confirmation} autoComplete="new-password" />
    <div className="d-flex flex-wrap gap-2 mt-4"><button className="btn btn-zen-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save Password"}</button>{mandatory ? <button className="btn btn-outline-secondary" disabled={busy} type="button" onClick={onLogout}>Logout</button> : <NavLink className="btn btn-outline-secondary" to={roleHome(user)}>Cancel</NavLink>}</div>
  </form></div></section></main>;
}

function PasswordInput({ id, label, value, onChange, error, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return <div className="mb-3"><label className="form-label" htmlFor={id}>{label}</label><div className="input-group"><input autoComplete={autoComplete} className={`form-control${error ? " is-invalid" : ""}`} id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} {...(error ? { "aria-invalid": true, "aria-describedby": errorId } : {})} /><button aria-label={visible ? `Hide ${label}` : `Show ${label}`} className="btn btn-outline-secondary" type="button" onClick={() => setVisible((current) => !current)}>{visible ? "Hide" : "Show"}</button></div>{error && <div className="invalid-feedback d-block" id={errorId}>{error}</div>}</div>;
}

function AccessDenied({ user, onLogout, logoutError }: { user: AuthUser; onLogout: () => void; logoutError: string }) {
  return <Shell user={user} onLogout={onLogout} logoutError={logoutError}><section className="card shadow-sm"><div className="card-body"><h1 className="h3">Access denied</h1><p>You do not have permission to open this page.</p><NavLink className="btn btn-zen-primary" to={roleHome(user)}>Go to my workspace</NavLink></div></section></Shell>;
}

export default function App() {
  const [state, setState] = useState<SessionState>("checking");
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [referenceFailure, setReferenceFailure] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [bootstrapError, setBootstrapError] = useState("");

  async function bootstrap() {
    setState("checking"); setBootstrapError("");
    try { setAuth(await currentUser()); setState("ready"); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setState("guest");
      else { setBootstrapError(cause instanceof Error ? cause.message : "Unable to check your session."); setState("error"); }
    }
  }

  async function loadReferences() {
    setReferenceFailure(false); setReferenceData(null);
    try { setReferenceData(await loadReferenceData()); }
    catch { setReferenceFailure(true); }
  }

  async function signOut() {
    setLogoutError("");
    try {
      await logout();
      setAuth(null); setReferenceData(null); setState("guest");
    } catch (cause) { setLogoutError(cause instanceof Error ? cause.message : "Unable to sign out. Please try again."); }
  }

  useEffect(() => { sessionStorage.removeItem("toktickit.requesterId"); void bootstrap(); }, []);
  useEffect(() => {
    if (state === "ready" && auth?.user.role === "REQUESTER" && !auth.user.mustChangePassword) void loadReferences();
  }, [auth?.user.id, auth?.user.mustChangePassword, auth?.user.role, state]);

  if (state === "checking") return <main className="auth-page min-vh-100"><p role="status">Checking your session…</p></main>;
  if (state === "error") return <main className="auth-page min-vh-100"><section className="card auth-card shadow-sm"><div className="card-body p-4"><div className="alert alert-danger mb-0" role="alert">{bootstrapError}<button className="btn btn-sm btn-danger ms-2" onClick={() => void bootstrap()}>Retry</button></div></div></section></main>;
  if (!auth) return <Routes><Route path="/login" element={<Login onAuthenticated={(result) => { setAuth(result); setState("ready"); }} />} /><Route path="*" element={<Navigate replace to="/login" />} /></Routes>;

  const user = auth.user;
  const requester: Requester = { id: user.id, name: user.name, email: user.email };
  const commonShell = { user, onLogout: () => void signOut(), logoutError };
  if (user.mustChangePassword) return <Routes><Route path="/change-password" element={<ChangePassword user={user} mandatory onLogout={() => void signOut()} onChanged={(result) => { setAuth(result); setState("ready"); }} />} /><Route path="*" element={<Navigate replace to="/change-password" />} /></Routes>;

  const requesterContent = referenceFailure ? <div className="alert alert-danger" role="alert">Unable to load ticket reference data. <button className="btn btn-sm btn-danger ms-2" onClick={() => void loadReferences()}>Retry</button></div> : !referenceData ? <p role="status">Loading your workspace…</p> : null;
  return <Routes>
    <Route path="/login" element={<Navigate replace to={roleHome(user)} />} />
    <Route path="/change-password" element={<ChangePassword user={user} mandatory={false} onLogout={() => void signOut()} onChanged={(result) => { setAuth(result); setState("ready"); }} />} />
    <Route path="/tickets" element={user.role === "REQUESTER" ? <Shell {...commonShell} wide>{requesterContent ?? <MyTickets data={referenceData!} />}</Shell> : <AccessDenied {...commonShell} />} />
    <Route path="/tickets/new" element={user.role === "REQUESTER" ? <Shell {...commonShell}>{requesterContent ?? <CreateTicket requester={requester} data={referenceData!} />}</Shell> : <AccessDenied {...commonShell} />} />
    <Route path="/tickets/:ticketId" element={user.role === "REQUESTER" ? <Shell {...commonShell}>{requesterContent ?? <TicketRoute requester={requester} />}</Shell> : <AccessDenied {...commonShell} />} />
    <Route path="/staff/tickets" element={user.role === "REQUESTER" ? <AccessDenied {...commonShell} /> : <Shell {...commonShell} wide><StaffQueue /></Shell>} />
    <Route path="/staff/tickets/:ticketId" element={user.role === "REQUESTER" ? <AccessDenied {...commonShell} /> : <Shell {...commonShell} wide><StaffTicketDetailRoute /></Shell>} />
    <Route path="/admin/users" element={user.role === "ADMINISTRATOR" ? <Shell {...commonShell} wide><UserManagement currentUserId={user.id} onSelfReset={() => { setAuth(null); setReferenceData(null); setState("guest"); }} /></Shell> : <AccessDenied {...commonShell} />} />
    <Route path="*" element={<Navigate replace to={roleHome(user)} />} />
  </Routes>;
}

function TicketRoute({ requester }: { requester: Requester }) {
  const ticketId = Number(useParams().ticketId);
  return Number.isInteger(ticketId) && ticketId > 0 ? <TicketDetailPage requester={requester} ticketId={ticketId} /> : <Navigate replace to="/tickets" />;
}

function StaffTicketDetailRoute() {
  const ticketId = Number(useParams().ticketId);
  return Number.isInteger(ticketId) && ticketId > 0 ? <StaffTicketDetail ticketId={ticketId} /> : <Navigate replace to="/staff/tickets" />;
}
