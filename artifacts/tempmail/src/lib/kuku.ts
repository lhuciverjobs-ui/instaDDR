export interface KukuAddress {
  address: string;
  createdAt: string;
  alias?: string;
}

export interface KukuMailMeta {
  num: string;
  key: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
}

export interface KukuInboxResponse {
  address: string;
  count: number;
  empty: boolean;
  mails: KukuMailMeta[];
}

export interface KukuMailDetail {
  num: string;
  key: string;
  html: string;
}

export interface KukuDomain {
  domain: string;
  isNew: boolean;
}

export interface GenerateAddressOptions {
  domain?: string;
  username?: string;
}

const ADDRESSES_KEY = "kuku.addresses";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

localStorage.removeItem("kuku.session");
sessionStorage.removeItem("kuku.session");

export function getAddresses(): KukuAddress[] {
  try {
    const data = localStorage.getItem(ADDRESSES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function addAddress(address: string) {
  const current = getAddresses();
  if (current.some((a) => a.address === address)) return;
  const entry: KukuAddress = { address, createdAt: new Date().toISOString() };
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify([entry, ...current]));
}

export function setAddressAlias(address: string, alias: string) {
  const current = getAddresses();
  const next = current.map((a) =>
    a.address === address ? { ...a, alias: alias.trim() || undefined } : a,
  );
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(next));
}

export function removeAddress(address: string) {
  const current = getAddresses();
  const next = current.filter((a) => a.address !== address);
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(next));
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${baseUrl}/api/kuku${endpoint}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export async function bootstrapSession(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/session", {
    method: "POST",
  });
}

export async function generateAddress(
  options: GenerateAddressOptions = {},
): Promise<KukuAddress> {
  await bootstrapSession();
  const payload: Record<string, unknown> = {};
  if (options.domain) payload.domain = options.domain;
  if (options.username) payload.username = options.username;

  const res = await fetch(`${baseUrl}/api/kuku/address`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const data = (await res.json()) as { address: string };
  addAddress(data.address);
  return { address: data.address, createdAt: new Date().toISOString() };
}

export async function fetchDomains(): Promise<KukuDomain[]> {
  const data = await apiFetch<{ domains: KukuDomain[] }>("/domains");
  return data.domains;
}

export async function fetchInbox(address: string): Promise<KukuInboxResponse> {
  return apiFetch<KukuInboxResponse>(`/inbox?address=${encodeURIComponent(address)}`);
}

export async function fetchMailDetail(num: string, key: string): Promise<KukuMailDetail> {
  return apiFetch<KukuMailDetail>(`/mail?num=${encodeURIComponent(num)}&key=${encodeURIComponent(key)}`);
}

export async function deleteMail(num: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/mail?num=${encodeURIComponent(num)}`, {
    method: "DELETE",
  });
}
