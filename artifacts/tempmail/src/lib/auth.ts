const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${baseUrl}/api/auth${endpoint}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    let msg = `Auth error: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getAuthStatus(): Promise<boolean> {
  const data = await authFetch<{ authenticated: boolean }>("/status");
  return data.authenticated;
}

export async function login(password: string): Promise<void> {
  await authFetch<{ authenticated: boolean }>("/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await authFetch<{ authenticated: boolean }>("/logout", {
    method: "POST",
    body: "{}",
  });
}
