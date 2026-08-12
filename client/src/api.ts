const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const [healthResponse, categoriesResponse] = await Promise.all([
    fetch(`${API_URL}/api/health`),
    fetch(`${API_URL}/api/categories`),
  ]);
  if (!healthResponse.ok || !categoriesResponse.ok) throw new Error("System check failed");

  const health = await healthResponse.json();
  return { online: health.status === "ok", categories: await categoriesResponse.json() };
}
