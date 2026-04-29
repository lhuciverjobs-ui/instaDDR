import { Router, type IRouter } from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

const KUKU_BASE = "https://m.kuku.lu";
const KUKU_VERIFICATION_MESSAGE =
  "Kuku.lu meminta verifikasi Cloudflare Turnstile untuk session backend. Verifikasi di browser biasa tidak otomatis masuk ke backend; untuk local test, isi KUKU_COOKIE dari browser yang sudah terverifikasi.";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";

type CurlResult = {
  status: number;
  body: string;
  setCookies: string[];
};

function curlFetch(
  url: string,
  opts: { cookieHeader?: string; method?: "GET" | "POST"; referer?: string } = {},
): Promise<CurlResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "-sS",
      "-L",
      "-D",
      "-",
      "--compressed",
      "-A",
      UA,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: id,en-US;q=0.7,en;q=0.3",
      "-H",
      `Referer: ${opts.referer ?? `${KUKU_BASE}/`}`,
    ];
    if (opts.cookieHeader) {
      args.push("-H", `Cookie: ${opts.cookieHeader}`);
    }
    if (opts.method === "POST") {
      args.push("-X", "POST");
    }
    args.push(url);

    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited ${code}: ${stderr}`));
        return;
      }
      // Split off all header blocks from any redirect chain — last block is the final response.
      const blocks = stdout.split(/\r?\n\r?\n/);
      // Find the last block that starts with HTTP/
      let lastHeaderIdx = -1;
      for (let i = 0; i < blocks.length; i++) {
        if (/^HTTP\/[0-9.]+ \d+/.test(blocks[i] ?? "")) {
          lastHeaderIdx = i;
        }
      }
      if (lastHeaderIdx === -1) {
        resolve({ status: 0, body: stdout, setCookies: [] });
        return;
      }
      const headerBlock = blocks[lastHeaderIdx] ?? "";
      const body = blocks.slice(lastHeaderIdx + 1).join("\n\n");

      const lines = headerBlock.split(/\r?\n/);
      const statusLine = lines[0] ?? "";
      const m = statusLine.match(/^HTTP\/[0-9.]+ (\d+)/);
      const status = m ? Number(m[1]) : 0;

      // Collect all set-cookie across the entire chain so we capture all cookies.
      const setCookies: string[] = [];
      for (let i = 0; i <= lastHeaderIdx; i++) {
        const block = blocks[i];
        if (!block) continue;
        for (const line of block.split(/\r?\n/)) {
          if (/^set-cookie:/i.test(line)) {
            setCookies.push(line.replace(/^set-cookie:\s*/i, ""));
          }
        }
      }

      resolve({ status, body, setCookies });
    });
  });
}

function parseSetCookies(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of lines) {
    const [pair] = line.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (value === "deleted" || value === "") {
      delete out[name];
      continue;
    }
    out[name] = value;
  }
  return out;
}

function parseCookieHeaderString(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

function mergeCookies(
  current: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  return { ...current, ...incoming };
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

type KukuSession = { cookie: string; csrf: string; subtoken?: string };
type StoredKukuSession = {
  session: KukuSession;
  expiresAt: number;
};

const SESSION_COOKIE = "kuku_sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const sessionStore = new Map<string, StoredKukuSession>();

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

function pruneSessions() {
  const now = Date.now();
  for (const [sid, entry] of sessionStore) {
    if (entry.expiresAt <= now) {
      sessionStore.delete(sid);
    }
  }
}

function readStoredSession(req: { cookies?: Record<string, string> }): KukuSession | undefined {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return undefined;
  const entry = sessionStore.get(sid);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) sessionStore.delete(sid);
    return undefined;
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  return entry.session;
}

function persistSession(
  req: { cookies?: Record<string, string> },
  res: { cookie: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => void },
  session: KukuSession,
) {
  pruneSessions();
  const sid = req.cookies?.[SESSION_COOKIE] || randomUUID();
  sessionStore.set(sid, { session, expiresAt: Date.now() + SESSION_TTL_MS });
  res.cookie(SESSION_COOKIE, sid, sessionCookieOptions());
}

function sessionFromJar(jar: Record<string, string>, csrf: string, subtoken: string): KukuSession {
  return { cookie: cookieHeader(jar), csrf, subtoken };
}

function jarFromSession(session: KukuSession | undefined): {
  jar: Record<string, string>;
  csrf: string;
  subtoken: string;
} {
  if (!session || typeof session.cookie !== "string" || typeof session.csrf !== "string") {
    return { jar: {}, csrf: "", subtoken: "" };
  }
  const jar: Record<string, string> = {};
  for (const part of session.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return {
    jar,
    csrf: session.csrf,
    subtoken: typeof session.subtoken === "string" ? session.subtoken : "",
  };
}

async function bootstrapSession(): Promise<{
  jar: Record<string, string>;
  csrf: string;
  subtoken: string;
}> {
  const seededCookie = process.env.KUKU_COOKIE?.trim();
  if (seededCookie) {
    const jar = parseCookieHeaderString(seededCookie);
    const csrf = jar["cookie_csrf_token"] ?? "";
    const subtoken = await fetchSubtoken(jar);
    return { jar, csrf, subtoken };
  }

  const res = await curlFetch(`${KUKU_BASE}/id.php`);
  const jar = parseSetCookies(res.setCookies);
  const csrf = jar["cookie_csrf_token"] ?? "";
  const subtoken = await fetchSubtoken(jar);
  return { jar, csrf, subtoken };
}

async function fetchSubtoken(jar: Record<string, string>): Promise<string> {
  const res = await curlFetch(`${KUKU_BASE}/recv.php`, {
    cookieHeader: cookieHeader(jar),
    referer: `${KUKU_BASE}/id.php`,
  });
  return (
    res.body.match(/csrf_subtoken_check=([a-f0-9]{16,64})/i)?.[1] ??
    res.body.match(/csrf_subtoken_check['"]?\s*[:=]\s*['"]([a-f0-9]{16,64})/i)?.[1] ??
    ""
  );
}

async function ensureSessionTokens(session: KukuSession | undefined): Promise<{
  jar: Record<string, string>;
  csrf: string;
  subtoken: string;
}> {
  let { jar, csrf, subtoken } = jarFromSession(session);
  if (!csrf) {
    return bootstrapSession();
  }
  if (!subtoken) {
    subtoken = await fetchSubtoken(jar);
  }
  return { jar, csrf, subtoken };
}

async function ensureRequestSession(
  req: { cookies?: Record<string, string> },
  res: { cookie: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => void },
  fallback?: KukuSession,
): Promise<{
  jar: Record<string, string>;
  csrf: string;
  subtoken: string;
}> {
  const session = readStoredSession(req) ?? fallback;
  const tokens = await ensureSessionTokens(session);
  persistSession(req, res, sessionFromJar(tokens.jar, tokens.csrf, tokens.subtoken));
  return tokens;
}

router.post("/kuku/session", async (req, res): Promise<void> => {
  try {
    const { jar, csrf, subtoken } = await bootstrapSession();
    if (!csrf) {
      req.log.error({ jar }, "Failed to obtain kuku.lu csrf token");
      res.status(502).json({ error: "Failed to bootstrap session" });
      return;
    }
    persistSession(req, res, sessionFromJar(jar, csrf, subtoken));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Bootstrap failed");
    res.status(502).json({ error: "Upstream unreachable" });
  }
});

type AddressRequestBody = {
  session?: KukuSession;
  domain?: string;
  username?: string;
};

function isValidUsername(s: string): boolean {
  return /^[a-z0-9._-]{1,32}$/i.test(s);
}

function isValidDomain(s: string): boolean {
  return /^[a-z0-9.-]{2,64}\.[a-z]{2,12}$/i.test(s);
}

function needsHumanVerification(html: string): boolean {
  return /recaptcha_createaccount\.php|cf-turnstile|submitRecaptcha|challenges\.cloudflare\.com/i.test(
    html,
  );
}

router.post("/kuku/address", async (req, res): Promise<void> => {
  const body = (req.body && typeof req.body === "object"
    ? (req.body as AddressRequestBody)
    : {}) as AddressRequestBody;

  let { jar, csrf, subtoken } = await ensureRequestSession(req, res, body.session);

  if (!csrf) {
    res.status(502).json({ error: "No session available" });
    return;
  }
  if (!subtoken) {
    req.log.warn("Kuku subtoken unavailable; human verification likely required");
    res.status(409).json({ error: KUKU_VERIFICATION_MESSAGE });
    return;
  }

  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";

  let url: string;

  if (domain) {
    if (!isValidDomain(domain)) {
      res.status(400).json({ error: "Invalid domain" });
      return;
    }
    if (username && !isValidUsername(username)) {
      res
        .status(400)
        .json({ error: "Username only allows letters, numbers, dot, underscore, hyphen (max 32)" });
      return;
    }
    const finalUser =
      username || `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    url =
      `${KUKU_BASE}/index.php?action=addMailAddrByManual` +
      `&csrf_token_check=${encodeURIComponent(csrf)}` +
      `&csrf_subtoken_check=${encodeURIComponent(subtoken)}` +
      `&by_system=1&nopost=1` +
      `&newdomain=${encodeURIComponent(domain)}` +
      `&newuser=${encodeURIComponent(finalUser)}` +
      `&recaptcha_token=`;
  } else {
    url =
      `${KUKU_BASE}/index.php?action=addMailAddrByAuto` +
      `&csrf_token_check=${encodeURIComponent(csrf)}` +
      `&csrf_subtoken_check=${encodeURIComponent(subtoken)}` +
      `&by_system=1&nopost=1`;
  }

  const upstream = await curlFetch(url, { cookieHeader: cookieHeader(jar) });

  jar = mergeCookies(jar, parseSetCookies(upstream.setCookies));

  const text = upstream.body.trim();

  if (needsHumanVerification(text) || (upstream.status === 200 && text === "")) {
    req.log.warn({ status: upstream.status }, "Kuku requires human verification");
    res.status(409).json({ error: KUKU_VERIFICATION_MESSAGE });
    return;
  }

  if (!text.startsWith("OK:")) {
    req.log.warn(
      { status: upstream.status, text: text.slice(0, 200) },
      "addMailAddr failed",
    );
    const cleaned = text.replace(/^NG:\s*/i, "");
    res.status(502).json({ error: cleaned || "Failed to create address" });
    return;
  }

  const address = text.slice(3).trim();

  res.json({
    address,
    session: { csrf, subtoken },
  });
});

type DomainEntry = { domain: string; isNew: boolean };

let cachedDomains: { at: number; entries: DomainEntry[] } | null = null;
const DOMAIN_CACHE_MS = 10 * 60 * 1000;

function parseDomains(html: string): DomainEntry[] {
  const seen = new Set<string>();
  const entries: DomainEntry[] = [];
  const regex =
    /name="input_manualmaildomain"[^>]*value="([a-z0-9.-]+\.[a-z]{2,12})"[^>]*>([\s\S]{0,400}?)<\/label>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const domain = (m[1] ?? "").toLowerCase();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const isNew = /NEW!/i.test(m[2] ?? "");
    entries.push({ domain, isNew });
  }
  if (entries.length === 0) {
    // Looser fallback: any radio with a kuku-style domain value
    const fallback =
      /<input\b(?=[^>]*name=["']input_manualmaildomain["'])(?=[^>]*value=["']([a-z0-9.-]+\.[a-z]{2,12})["'])[^>]*>/gi;
    let f: RegExpExecArray | null;
    while ((f = fallback.exec(html)) !== null) {
      const d = (f[1] ?? "").toLowerCase();
      if (!d || seen.has(d)) continue;
      seen.add(d);
      entries.push({ domain: d, isNew: false });
    }
  }
  return entries;
}

router.get("/kuku/domains", async (req, res): Promise<void> => {
  const force = req.query.refresh === "1";
  const now = Date.now();
  if (!force && cachedDomains && now - cachedDomains.at < DOMAIN_CACHE_MS) {
    res.json({ domains: cachedDomains.entries, cached: true });
    return;
  }

  const { jar } = await ensureRequestSession(req, res);

  const upstream = await curlFetch(`${KUKU_BASE}/index.php`, {
    cookieHeader: cookieHeader(jar),
  });

  const entries = parseDomains(upstream.body);
  if (entries.length === 0) {
    if (needsHumanVerification(upstream.body)) {
      req.log.warn(
        { bodyLength: upstream.body.length, status: upstream.status },
        "Kuku requires human verification before listing domains",
      );
      res.status(409).json({ error: KUKU_VERIFICATION_MESSAGE });
      return;
    }
    req.log.warn(
      { bodyLength: upstream.body.length, status: upstream.status },
      "Failed to parse any domains",
    );
    if (cachedDomains) {
      res.json({ domains: cachedDomains.entries, cached: true, stale: true });
      return;
    }
    res.status(502).json({ error: "No domains found" });
    return;
  }

  cachedDomains = { at: now, entries };
  res.json({ domains: entries, cached: false });
});

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => HTML_ENTITIES[m] ?? m);
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

type ParsedMail = {
  num: string;
  key: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
};

function parseInbox(html: string): ParsedMail[] {
  const mails: ParsedMail[] = [];
  // Each mail is referenced by openMailData(num,key)
  const seen = new Set<string>();
  const callRegex =
    /openMailData\(\s*['"]?(\d+)['"]?\s*,\s*['"]([a-zA-Z0-9_-]+)['"](?:\s*,\s*['"]([^'"]*)['"])?\s*\)/g;
  const calls: Array<{ num: string; key: string; meta: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = callRegex.exec(html)) !== null) {
    const id = `${m[1]}:${m[2]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    calls.push({ num: m[1] ?? "", key: m[2] ?? "", meta: m[3] ?? "", index: m.index });
  }

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]!;
    const areaIdx = html.lastIndexOf(`area_mail_${call.num}`, call.index);
    const cancelIdx = html.lastIndexOf(`link_cancelDeleteMail_${call.num}`, call.index);
    const start = Math.max(areaIdx, cancelIdx, 0);
    const end = i + 1 < calls.length ? calls[i + 1]!.index : html.length;
    const block = html.slice(start, end);
    const plain = stripTags(block);
    const meta = Object.fromEntries(
      call.meta
        .split(";")
        .map((part) => {
          const eq = part.indexOf("=");
          if (eq === -1) return ["", ""];
          return [
            part.slice(0, eq),
            decodeURIComponent(part.slice(eq + 1).replace(/\+/g, " ")),
          ];
        })
        .filter(([k]) => k),
    );

    const fromMatch =
      plain.match(/Pengirim:\s*([^$]+?)(?:\s*\$\('#link_maildata_|$)/i) ||
      block.match(/from-name[^>]*>([^<]+)</i) ||
      block.match(/<b[^>]*>([^<]{1,200})<\/b>/i) ||
      block.match(/From[^<]*<[^>]+>([^<]+@[^<]+)</i);
    const subjectMatch =
      plain.match(/tableUnreadNum\["\d+"\]\s*=\s*(?:true|false);\s*([\s\S]*?)\s+Penerima:/i) ||
      block.match(/subject[^>]*>([\s\S]{1,300}?)</i) ||
      block.match(/title=['"]([^'"]{1,200})['"]/);
    const dateMatch =
      plain.match(/\b(\d{1,2}:\d{2}\s*(?:\([^)]+\))?)/) ||
      block.match(/(\d{4}\/\d{1,2}\/\d{1,2}[^<\s]*\s*\d{1,2}:\d{2}(?::\d{2})?)/);
    const previewMatch = block.match(/preview[^>]*>([\s\S]{0,200}?)</i);
    const unread =
      new RegExp(`tableUnreadNum\\["${call.num}"\\]\\s*=\\s*true`).test(plain) ||
      /font-bold|unread|class=['"][^'"]*new[^'"]*['"]/i.test(block);
    const from = fromMatch ? stripTags(fromMatch[1] ?? "") : meta["from"] ?? "";

    mails.push({
      num: call.num,
      key: call.key,
      from,
      subject: subjectMatch ? stripTags(subjectMatch[1] ?? "") : "(no subject)",
      preview: previewMatch ? stripTags(previewMatch[1] ?? "") : "",
      receivedAt: dateMatch ? dateMatch[1] ?? "" : "",
      unread,
    });
  }
  return mails;
}

router.get("/kuku/inbox", async (req, res): Promise<void> => {
  const address = typeof req.query.address === "string" ? req.query.address : "";
  if (!address) {
    res.status(400).json({ error: "address query param is required" });
    return;
  }

  const { jar, csrf } = await ensureRequestSession(req, res);
  if (!csrf) {
    res.status(400).json({ error: "Missing kuku session" });
    return;
  }

  const url =
    `${KUKU_BASE}/recv._ajax.php?nopost=1` +
    `&q=${encodeURIComponent(address)}` +
    `&csrf_token_check=${encodeURIComponent(csrf)}` +
    `&t=${Date.now()}`;

  const upstream = await curlFetch(url, { cookieHeader: cookieHeader(jar) });
  const text = upstream.body;

  if (text.trim().startsWith("NG:")) {
    res.status(401).json({ error: text.trim() });
    return;
  }

  const mails = parseInbox(text);
  const empty =
    mails.length === 0 &&
    /Tidak ada email masuk|No mail|メールはありません|There are no mails/i.test(text);

  res.json({
    address,
    count: mails.length,
    empty,
    mails,
  });
});

router.get("/kuku/mail", async (req, res): Promise<void> => {
  const num = typeof req.query.num === "string" ? req.query.num : "";
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!num || !key) {
    res.status(400).json({ error: "num and key query params are required" });
    return;
  }

  const { jar, csrf } = await ensureRequestSession(req, res);
  if (!csrf) {
    res.status(400).json({ error: "Missing kuku session" });
    return;
  }

  const url =
    `${KUKU_BASE}/smphone.app.recv.view.php?num=${encodeURIComponent(num)}` +
    `&key=${encodeURIComponent(key)}` +
    `&csrf_token_check=${encodeURIComponent(csrf)}` +
    `&nopost=1&t=${Date.now()}`;

  const upstream = await curlFetch(url, { cookieHeader: cookieHeader(jar) });
  const html = upstream.body;

  res.json({ num, key, html });
});

router.delete("/kuku/mail", async (req, res): Promise<void> => {
  const num =
    typeof req.query.num === "string"
      ? req.query.num
      : typeof req.body?.num === "string"
        ? req.body.num
        : "";
  if (!/^\d+$/.test(num)) {
    res.status(400).json({ error: "num query param is required" });
    return;
  }

  const { jar, csrf, subtoken } = await ensureRequestSession(req, res);

  if (!csrf || !subtoken) {
    res.status(400).json({ error: "Missing kuku session token" });
    return;
  }

  const url =
    `${KUKU_BASE}/recv._ajax.php?action=delMail&nopost=1` +
    `&num=${encodeURIComponent(num)}` +
    `&csrf_token_check=${encodeURIComponent(csrf)}` +
    `&csrf_subtoken_check=${encodeURIComponent(subtoken)}` +
    `&t=${Date.now()}`;

  const upstream = await curlFetch(url, {
    cookieHeader: cookieHeader(jar),
    referer: `${KUKU_BASE}/recv.php`,
  });
  const text = upstream.body.trim();

  if (text.startsWith("OK")) {
    res.json({ ok: true, message: text });
    return;
  }

  if (text.startsWith("NG:")) {
    res.status(502).json({ error: text.slice(3).trim() || "Failed to delete mail" });
    return;
  }

  req.log.warn({ status: upstream.status, text: text.slice(0, 200) }, "Delete mail failed");
  res.status(502).json({ error: "Failed to delete mail" });
});

export default router;
