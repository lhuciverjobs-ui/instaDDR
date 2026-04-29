import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Terminal, Code2, Zap } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  title: string;
  description: string;
  request?: { headers?: Record<string, string>; body?: unknown };
  response: unknown;
  notes?: string[];
}

function CodeBlock({
  code,
  label,
  testId,
}: {
  code: string;
  label?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      {label && (
        <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
          {label}
        </div>
      )}
      <div className="relative">
        <pre
          className="bg-foreground text-background rounded-md p-4 text-xs sm:text-sm overflow-x-auto font-mono leading-relaxed"
          data-testid={testId}
        >
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-background/10 text-background/70 hover:bg-background/20 hover:text-background transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Salin kode"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: Endpoint["method"] }) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-1 rounded font-mono ${
        method === "GET"
          ? "bg-foreground text-background"
          : "border border-foreground text-foreground"
      }`}
    >
      {method}
    </span>
  );
}

export default function ApiDocs() {
  const { toast } = useToast();
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  const apiBase = useMemo(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    if (typeof window === "undefined") return `${base}/api/kuku`;
    return `${window.location.origin}${base}/api/kuku`;
  }, []);

  const endpoints: Endpoint[] = [
    {
      method: "POST",
      path: "/api/kuku/session",
      title: "Mulai Sesi",
      description:
        "Membuat sesi server-side. Browser menerima cookie httpOnly, sementara token Kuku tidak diekspos ke JavaScript.",
      response: {
        ok: true,
      },
      notes: [
        "Gunakan cookie yang dikirim browser otomatis. Tidak perlu menyimpan token Kuku di localStorage/sessionStorage.",
      ],
    },
    {
      method: "POST",
      path: "/api/kuku/address",
      title: "Buat Alamat Email",
      description:
        "Membuat alamat email sementara baru. Bisa acak atau custom dengan domain & nama pengguna pilihan Anda.",
      request: {
        headers: { "Content-Type": "application/json" },
        body: {
          domain: "hamham.uk",
          username: "halo123",
        },
      },
      response: {
        address: "halo123@hamham.uk",
      },
      notes: [
        "`domain` dan `username` opsional. Tanpa keduanya = acak.",
        "Hanya `username` saja akan ditolak - harus ada `domain` juga.",
        "Username diizinkan: huruf, angka, titik, underscore, hyphen (max 32 karakter).",
        "Jika Kuku.lu meminta Cloudflare Turnstile, server akan mengembalikan 409. Untuk local test, isi KUKU_COOKIE dari browser yang sudah terverifikasi.",
      ],
    },
    {
      method: "GET",
      path: "/api/kuku/domains",
      title: "Daftar Domain",
      description:
        "Mengambil daftar domain tersedia. Hasil di-cache 10 menit di server. Tambahkan `?refresh=1` untuk paksa refresh.",
      response: {
        domains: [
          { domain: "hamham.uk", isNew: false },
          { domain: "boxfi.uk", isNew: true },
          { domain: "neko2.net", isNew: false },
        ],
        cached: true,
      },
    },
    {
      method: "GET",
      path: "/api/kuku/inbox?address=halo@hamham.uk",
      title: "Ambil Kotak Masuk",
      description:
        "Mengambil daftar email untuk alamat tertentu. Polling endpoint ini setiap beberapa detik untuk update real-time.",
      response: {
        address: "halo@hamham.uk",
        count: 1,
        empty: false,
        mails: [
          {
            num: "12345",
            key: "abcdef",
            from: "noreply@example.com",
            subject: "Verifikasi Email Anda",
            preview: "Klik tautan ini untuk...",
            receivedAt: "2026-04-28T16:30:00Z",
            unread: true,
          },
        ],
      },
    },
    {
      method: "GET",
      path: "/api/kuku/mail?num=12345&key=abcdef",
      title: "Detail Pesan",
      description:
        "Mengambil HTML lengkap dari satu pesan. Render di sandbox untuk keamanan.",
      response: {
        num: "12345",
        key: "abcdef",
        html: "<html>...</html>",
      },
    },
    {
      method: "DELETE",
      path: "/api/kuku/mail?num=12345",
      title: "Hapus Pesan",
      description:
        "Menghapus satu pesan dari kotak masuk Kuku untuk session aktif.",
      response: {
        ok: true,
        message: "OK",
      },
      notes: [
        "Butuh session Kuku yang sama dengan inbox aktif.",
        "Penghapusan alamat tempmail di UI hanya menghapus daftar lokal browser, bukan akun/alamat upstream Kuku.",
      ],
    },
  ];

  const curlExample = `# 1. Login aplikasi dulu untuk mendapatkan cookie app_auth
curl -X POST ${window.location.origin}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -b app-cookies.txt -c app-cookies.txt \\
  -d '{"password":"dev-password"}'

# 2. Mulai sesi Kuku server-side
curl -X POST ${apiBase}/session -b app-cookies.txt -c app-cookies.txt

# 3. Buat alamat (acak)
curl -X POST ${apiBase}/address \\
  -H "Content-Type: application/json" \\
  -b app-cookies.txt -c app-cookies.txt \\
  -d '{}'

# 4. Buat alamat (custom)
curl -X POST ${apiBase}/address \\
  -H "Content-Type: application/json" \\
  -b app-cookies.txt -c app-cookies.txt \\
  -d '{"domain":"hamham.uk","username":"halo"}'

# 5. Cek inbox
curl "${apiBase}/inbox?address=halo@hamham.uk" -b app-cookies.txt`;

  const jsExample = `// Halaman web sudah login melalui AuthGate.
// Inisialisasi sesi Kuku server-side
await fetch("${apiBase}/session", { method: "POST", credentials: "include" });

// Buat alamat baru
const { address } = await fetch("${apiBase}/address", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    domain: "hamham.uk",      // opsional
    username: "halo"          // opsional
  })
}).then(r => r.json());

console.log("Alamat baru:", address);

// Polling inbox
setInterval(async () => {
  const inbox = await fetch(
    \`${apiBase}/inbox?address=\${address}\`,
    { credentials: "include" }
  ).then(r => r.json());

  inbox.mails.forEach(m => console.log(m.from, "-", m.subject));
}, 8000);`;

  const handlePing = async () => {
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await fetch(`${apiBase}/session`, { method: "POST" });
      const json = await res.json();
      setPingResult(JSON.stringify(json, null, 2));
      toast({ title: "Berhasil", description: "API merespons dengan baik" });
    } catch (e) {
      setPingResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPingLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">
          v1
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Dokumentasi API
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Akses InstaMail secara terprogram setelah login aplikasi. Token Kuku
          disimpan server-side di cookie httpOnly, dan origin request dibatasi
          lewat konfigurasi backend.
        </p>
      </div>

      <Card className="p-5 bg-foreground text-background border-foreground">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Base URL</h3>
        </div>
        <div className="font-mono text-sm break-all bg-background/10 p-3 rounded" data-testid="text-api-base">
          {apiBase}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePing}
            disabled={pingLoading}
            data-testid="button-ping-api"
          >
            <Terminal className="w-3.5 h-3.5 mr-1.5" />
            {pingLoading ? "Memuat..." : "Coba Sekarang"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-background hover:bg-background/10 hover:text-background"
            onClick={() => {
              navigator.clipboard.writeText(apiBase);
              toast({ title: "URL disalin" });
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Salin URL
          </Button>
        </div>
        {pingResult && (
          <pre
            className="mt-4 bg-background/10 text-background p-3 rounded text-xs font-mono overflow-x-auto max-h-48"
            data-testid="text-ping-result"
          >
            {pingResult}
          </pre>
        )}
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Code2 className="w-5 h-5" />
          Contoh Cepat
        </h2>
        <Tabs defaultValue="curl" className="w-full">
          <TabsList>
            <TabsTrigger value="curl" data-testid="tab-curl">cURL</TabsTrigger>
            <TabsTrigger value="js" data-testid="tab-js">JavaScript</TabsTrigger>
          </TabsList>
          <TabsContent value="curl" className="mt-3">
            <CodeBlock code={curlExample} testId="code-curl-example" />
          </TabsContent>
          <TabsContent value="js" className="mt-3">
            <CodeBlock code={jsExample} testId="code-js-example" />
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Endpoint</h2>
        <div className="space-y-4">
          {endpoints.map((ep) => (
            <Card key={ep.path} className="p-5 sm:p-6 space-y-4" data-testid={`endpoint-${ep.method.toLowerCase()}-${ep.path.replace(/[^a-z]/gi, "-")}`}>
              <div className="space-y-2">
                <div className="flex items-start gap-3 flex-wrap">
                  <MethodBadge method={ep.method} />
                  <code className="text-sm font-mono break-all">{ep.path}</code>
                </div>
                <h3 className="font-semibold text-lg">{ep.title}</h3>
                <p className="text-sm text-muted-foreground">{ep.description}</p>
              </div>

              {ep.request && (
                <div className="space-y-3">
                  {ep.request.headers && (
                    <CodeBlock
                      label="Headers"
                      code={Object.entries(ep.request.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n")}
                    />
                  )}
                  {ep.request.body !== undefined && (
                    <CodeBlock
                      label="Request body"
                      code={JSON.stringify(ep.request.body, null, 2)}
                    />
                  )}
                </div>
              )}

              <CodeBlock
                label="Response"
                code={JSON.stringify(ep.response, null, 2)}
              />

              {ep.notes && ep.notes.length > 0 && (
                <ul className="space-y-1.5 text-sm text-muted-foreground border-l-2 border-border pl-4">
                  {ep.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-5 bg-muted/40">
        <h3 className="font-semibold mb-2">Catatan</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>Gunakan APP_PASSWORD yang kuat sebelum deploy publik.</li>
          <li>Endpoint Kuku dilindungi login aplikasi dan cookie httpOnly.</li>
          <li>CORS dibatasi lewat ALLOWED_ORIGINS di backend.</li>
          <li>Session Kuku disimpan in-memory; gunakan storage eksternal kalau deploy multi-instance.</li>
          <li>Kuku.lu dapat meminta Cloudflare Turnstile untuk session baru.</li>
          <li>Email otomatis dihapus dari kuku.lu setelah 30 hari.</li>
        </ul>
      </Card>
    </div>
  );
}
