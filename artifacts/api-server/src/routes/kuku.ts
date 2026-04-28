import { Router, type IRouter } from "express";
import { spawn } from "node:child_process";

const router: IRouter = Router();

const KUKU_BASE = "https://m.kuku.lu";
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

type KukuSession = { cookie: string; csrf: string };

function jarFromSession(session: KukuSession | undefined): {
  jar: Record<string, string>;
  csrf: string;
} {
  if (!session || typeof session.cookie !== "string" || typeof session.csrf !== "string") {
    return { jar: {}, csrf: "" };
  }
  const jar: Record<string, string> = {};
  for (const part of session.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return { jar, csrf: session.csrf };
}

async function bootstrapSession(): Promise<{
  jar: Record<string, string>;
  csrf: string;
}> {
  const res = await curlFetch(`${KUKU_BASE}/id.php`);
  const jar = parseSetCookies(res.setCookies);
  const csrf = jar["cookie_csrf_token"] ?? "";
  return { jar, csrf };
}

router.post("/kuku/session", async (req, res): Promise<void> => {
  try {
    const { jar, csrf } = await bootstrapSession();
    if (!csrf) {
      req.log.error({ jar }, "Failed to obtain kuku.lu csrf token");
      res.status(502).json({ error: "Failed to bootstrap session" });
      return;
    }
    res.json({
      session: {
        cookie: cookieHeader(jar),
        csrf,
      },
    });
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

router.post("/kuku/address", async (req, res): Promise<void> => {
  const body = (req.body && typeof req.body === "object"
    ? (req.body as AddressRequestBody)
    : {}) as AddressRequestBody;

  let { jar, csrf } = jarFromSession(body.session);

  if (!csrf) {
    const fresh = await bootstrapSession();
    jar = fresh.jar;
    csrf = fresh.csrf;
  }

  if (!csrf) {
    res.status(502).json({ error: "No session available" });
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
      `&by_system=1&nopost=1` +
      `&newdomain=${encodeURIComponent(domain)}` +
      `&newuser=${encodeURIComponent(finalUser)}` +
      `&recaptcha_token=`;
  } else {
    url =
      `${KUKU_BASE}/index.php?action=addMailAddrByAuto` +
      `&csrf_token_check=${encodeURIComponent(csrf)}` +
      `&by_system=1&nopost=1`;
  }

  const upstream = await curlFetch(url, { cookieHeader: cookieHeader(jar) });

  jar = mergeCookies(jar, parseSetCookies(upstream.setCookies));

  const text = upstream.body.trim();

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
    session: { cookie: cookieHeader(jar), csrf },
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
    const fallback = /name="input_manualmaildomain"[^>]*value="([a-z0-9.-]+\.[a-z]{2,12})"/gi;
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

  let { jar, csrf } = readSessionFromHeader(req);
  if (!csrf) {
    const fresh = await bootstrapSession();
    jar = fresh.jar;
    csrf = fresh.csrf;
  }

  const upstream = await curlFetch(`${KUKU_BASE}/index.php`, {
    cookieHeader: cookieHeader(jar),
  });

  const entries = parseDomains(upstream.body);
  if (entries.length === 0) {
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
  const callRegex = /openMailData\(\s*['"]?(\d+)['"]?\s*,\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;
  const calls: Array<{ num: string; key: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = callRegex.exec(html)) !== null) {
    const id = `${m[1]}:${m[2]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    calls.push({ num: m[1] ?? "", key: m[2] ?? "", index: m.index });
  }

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]!;
    const start = call.index;
    const end = i + 1 < calls.length ? calls[i + 1]!.index : html.length;
    const block = html.slice(start, end);

    const fromMatch =
      block.match(/from-name[^>]*>([^<]+)</i) ||
      block.match(/<b[^>]*>([^<]{1,200})<\/b>/i) ||
      block.match(/From[^<]*<[^>]+>([^<]+@[^<]+)</i);
    const subjectMatch =
      block.match(/subject[^>]*>([\s\S]{1,300}?)</i) ||
      block.match(/title=['"]([^'"]{1,200})['"]/);
    const dateMatch = block.match(
      /(\d{4}\/\d{1,2}\/\d{1,2}[^<\s]*\s*\d{1,2}:\d{2}(?::\d{2})?)/,
    );
    const previewMatch = block.match(/preview[^>]*>([\s\S]{0,200}?)</i);
    const unread = /font-bold|unread|class=['"][^'"]*new[^'"]*['"]/i.test(block);

    mails.push({
      num: call.num,
      key: call.key,
      from: fromMatch ? stripTags(fromMatch[1] ?? "") : "",
      subject: subjectMatch ? stripTags(subjectMatch[1] ?? "") : "(no subject)",
      preview: previewMatch ? stripTags(previewMatch[1] ?? "") : "",
      receivedAt: dateMatch ? dateMatch[1] ?? "" : "",
      unread,
    });
  }
  return mails;
}

function readSessionFromHeader(req: { header(name: string): string | undefined }): {
  jar: Record<string, string>;
  csrf: string;
} {
  const sessionHeader = req.header("x-kuku-session");
  if (!sessionHeader) return { jar: {}, csrf: "" };
  try {
    const parsed = JSON.parse(sessionHeader) as KukuSession;
    return jarFromSession(parsed);
  } catch {
    return { jar: {}, csrf: "" };
  }
}

router.get("/kuku/inbox", async (req, res): Promise<void> => {
  const address = typeof req.query.address === "string" ? req.query.address : "";
  if (!address) {
    res.status(400).json({ error: "address query param is required" });
    return;
  }

  const { jar, csrf } = readSessionFromHeader(req);
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

  const { jar, csrf } = readSessionFromHeader(req);
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

export default router;
