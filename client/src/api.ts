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
