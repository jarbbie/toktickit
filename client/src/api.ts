const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
}

// Issue 2 — call the health endpoint. Issue 4 will add categories here.
export async function checkSystem(): Promise<SystemStatus> {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) throw new Error("Backend health check failed");
  return { online: true };
}
