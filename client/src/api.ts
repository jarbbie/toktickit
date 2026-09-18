const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface ReferenceItem {
  id: number;
  name: string;
}

export interface Requester extends ReferenceItem {
  email: string;
}

export interface ReferenceData {
  categories: ReferenceItem[];
  relatedSystems: ReferenceItem[];
}

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthResult {
  user: AuthUser;
  expiresAt: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly fieldErrors?: Record<string, string>, readonly retryAfter?: number) {
    super(message);
  }
}

export interface TicketInput {
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  summary: string;
  description: string;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  status: TicketStatus;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: TicketInput["requestedPriority"];
  itPriority: TicketInput["requestedPriority"];
  status: TicketStatus;
  category: ReferenceItem;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StaffQueueItem extends TicketListItem {
  requester: { id: number; name: string };
  ownerId: number | null;
  owner: { id: number; name: string; role: UserRole } | null;
  resolutionIndicatedAt: string | null;
}

export interface StaffQueueResponse {
  items: StaffQueueItem[];
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
  requester: { id: number; name: string };
  description: string;
  categoryId: number;
  relatedSystemId: number;
  relatedSystem: ReferenceItem;
  itPriority: TicketInput["requestedPriority"];
  ownerId: number | null;
  owner: { id: number; name: string; role: UserRole } | null;
  resolutionIndicatedAt: string | null;
  attachments: Attachment[];
}

export interface PublicComment {
  id: number;
  ticketId: number;
  body: string;
  author: { id: number; name: string };
  createdAt: string;
}

export interface TicketQuery {
  search?: string;
  categoryId?: string;
  requestedPriority?: TicketInput["requestedPriority"] | "";
  status?: TicketStatus | "";
  sortBy?: "updatedAt" | "createdAt" | "ticketNumber" | "requestedPriority";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface StaffQueueQuery {
  search?: string;
  categoryId?: string;
  requestedPriority?: TicketInput["requestedPriority"] | "";
  itPriority?: TicketInput["requestedPriority"] | "";
  status?: TicketStatus | "";
  ownership?: "all" | "mine" | "assigned" | "unassigned";
  sortBy?: "updatedAt" | "createdAt" | "ticketNumber" | "requestedPriority" | "itPriority" | "status";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

async function loadJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === "string" ? body.error : "Unable to complete the request.", response.status,
      typeof body.code === "string" ? body.code : undefined,
      body.fieldErrors && typeof body.fieldErrors === "object" ? body.fieldErrors as Record<string, string> : undefined,
      Number(response.headers.get("Retry-After")) || undefined,
    );
  }
  return body as T;
}

export async function loadReferenceData(): Promise<ReferenceData> {
  const [categories, relatedSystems] = await Promise.all([
    loadJson<ReferenceItem[]>("/api/categories"),
    loadJson<ReferenceItem[]>("/api/related-systems"),
  ]);

  return { categories, relatedSystems };
}

export function login(email: string, password: string) {
  return loadJson<AuthResult>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
}

export function currentUser() {
  return loadJson<AuthResult>("/api/auth/me");
}

export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
  if (response.status === 204) return;
  const body = await response.json().catch(() => ({}));
  throw new ApiError(typeof body.error === "string" ? body.error : "Unable to sign out.", response.status, typeof body.code === "string" ? body.code : undefined);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return loadJson<AuthResult>("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function createTicket(ticket: TicketInput): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to create ticket.");
  return body as CreatedTicket;
}

export async function loadTickets(query: TicketQuery): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  const response = await fetch(`${API_URL}/api/tickets?${params}`, { credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load tickets.");
  return body as TicketListResponse;
}

export function loadStaffTickets(query: StaffQueueQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return loadJson<StaffQueueResponse>(`/api/staff/tickets?${params}`);
}

export async function loadTicket(ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, { credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load ticket.");
  return body as TicketDetail;
}

export async function uploadAttachment(ticketId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, { method: "POST", credentials: "include", body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to upload attachment.");
  return body as Attachment;
}

export async function removeAttachment(attachmentId: number, reason: string): Promise<Attachment> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to remove attachment.");
  return body as Attachment;
}

export function attachmentDownloadUrl(attachmentId: number) {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

export function loadPublicComments(ticketId: number) {
  return loadJson<PublicComment[]>(`/api/tickets/${ticketId}/public-comments`);
}

export function addPublicComment(ticketId: number, body: string) {
  return loadJson<PublicComment>(`/api/tickets/${ticketId}/public-comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
}

export function indicateResolution(ticketId: number) {
  return loadJson<{ ticketId: number; resolutionIndicatedAt: string; status: string; updatedAt: string }>(`/api/tickets/${ticketId}/resolution-indication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
