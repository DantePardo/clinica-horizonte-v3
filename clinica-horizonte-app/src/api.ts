import { accessToken } from './auth';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Error de servicio (${response.status})`);
  }
  return response.json() as Promise<T>;
}
