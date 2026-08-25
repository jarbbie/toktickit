const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface ReferenceItem {
  id: number;
  name: string;
}

export interface Requester extends ReferenceItem {
  email: string;
}

export interface ReferenceData {
  requesters: Requester[];
  categories: ReferenceItem[];
  relatedSystems: ReferenceItem[];
}

export interface TicketInput {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  summary: string;
  description: string;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  status: "NEW";
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: TicketInput["requestedPriority"];
  status: "NEW";
  category: ReferenceItem;
  updatedAt: string;
}

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Attachment {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface TicketDetail extends TicketListItem {
  requesterId: number;
  description: string;
  createdAt: string;
  relatedSystem: ReferenceItem;
  attachments: Attachment[];
}

export interface TicketQuery {
  search?: string;
  categoryId?: string;
  requestedPriority?: TicketInput["requestedPriority"] | "";
  status?: "NEW" | "";
  sortBy?: "updatedAt" | "createdAt" | "ticketNumber" | "requestedPriority";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error("Reference data request failed");
  return response.json() as Promise<T>;
}

export async function loadReferenceData(): Promise<ReferenceData> {
  const [requesters, categories, relatedSystems] = await Promise.all([
    loadJson<Requester[]>("/api/requesters"),
    loadJson<ReferenceItem[]>("/api/categories"),
    loadJson<ReferenceItem[]>("/api/related-systems"),
  ]);

  return { requesters, categories, relatedSystems };
}

export async function createTicket(ticket: TicketInput): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to create ticket.");
  return body as CreatedTicket;
}

export async function loadTickets(requesterId: number, query: TicketQuery): Promise<TicketListResponse> {
  const params = new URLSearchParams({ requesterId: String(requesterId) });
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  const response = await fetch(`${API_URL}/api/tickets?${params}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load tickets.");
  return body as TicketListResponse;
}

export async function loadTicket(ticketId: number, requesterId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}?requesterId=${requesterId}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load ticket.");
  return body as TicketDetail;
}

export async function uploadAttachment(ticketId: number, requesterId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.set("requesterId", String(requesterId));
  form.set("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, { method: "POST", body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to upload attachment.");
  return body as Attachment;
}

export async function removeAttachment(attachmentId: number, requesterId: number, reason: string): Promise<Attachment> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterId, reason }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to remove attachment.");
  return body as Attachment;
}

export function attachmentDownloadUrl(attachmentId: number, requesterId: number) {
  return `${API_URL}/api/attachments/${attachmentId}/download?requesterId=${requesterId}`;
}
