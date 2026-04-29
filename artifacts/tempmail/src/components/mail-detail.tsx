import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMailDetail } from "@/hooks/use-kuku";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";

interface MailDetailProps {
  num: string | null;
  mailKey: string | null;
  subject: string;
  from: string;
  receivedAt: string;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function buildEmailDocument(html: string): string {
  const safeHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");

  const readerCss = `
    <style>
      :root { color-scheme: light; }
      html, body {
        margin: 0 !important;
        min-height: 100% !important;
        background: #ffffff !important;
        color: #111827 !important;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
      }
      body {
        padding: 24px !important;
        overflow-wrap: anywhere !important;
      }
      * {
        box-sizing: border-box !important;
        max-width: 100% !important;
      }
      table {
        width: auto !important;
        border-collapse: collapse !important;
      }
      td, th {
        vertical-align: top !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
        border: 0 !important;
      }
      a {
        color: #2563eb !important;
      }
      p {
        margin: 0 0 12px !important;
      }
      h1, h2, h3 {
        color: #111827 !important;
        line-height: 1.25 !important;
        margin: 0 0 12px !important;
      }
      hr {
        border: 0 !important;
        border-top: 1px solid #e5e7eb !important;
        margin: 16px 0 !important;
      }
    </style>
  `;

  if (/<head[^>]*>/i.test(safeHtml)) {
    return safeHtml.replace(/<head([^>]*)>/i, `<head$1>${readerCss}`);
  }

  return `<!doctype html><html><head>${readerCss}</head><body>${safeHtml}</body></html>`;
}

export function MailDetail({
  num,
  mailKey,
  subject,
  from,
  receivedAt,
  onClose,
  onDelete,
  isDeleting,
}: MailDetailProps) {
  const { data, isLoading, isError } = useMailDetail(num || undefined, mailKey || undefined);
  const isOpen = !!num && !!mailKey;

  let formattedDate = "Baru saja";
  if (receivedAt) {
    try {
      formattedDate = format(new Date(receivedAt), "PPP 'pukul' p", { locale: id });
    } catch {
      // fallback
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl flex flex-col p-0 border-l-border/40 shadow-2xl bg-background">
        <SheetHeader className="px-6 py-5 border-b border-border/40 bg-background">
          <div className="flex items-start justify-between gap-4 pr-10">
            <SheetTitle className="text-xl font-semibold leading-tight">{subject || "Tanpa Subjek"}</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="h-9 shrink-0 gap-2"
              aria-label="Hapus email"
              title="Hapus email"
              data-testid="button-delete-mail"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>Hapus Email</span>
            </Button>
          </div>
          <SheetDescription className="flex flex-col gap-1 mt-2 text-sm">
            <span className="font-medium text-foreground">Dari: {from}</span>
            <span>Diterima: {formattedDate}</span>
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 relative bg-muted/30 overflow-hidden p-3 sm:p-4">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            </div>
          )}
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive p-6 text-center">
              Gagal memuat konten email. Silakan coba lagi nanti.
            </div>
          )}
          {data?.html && (
            <iframe
              srcDoc={buildEmailDocument(data.html)}
              sandbox=""
              title="Isi Email"
              className="w-full h-full border border-border/60 rounded-lg bg-white shadow-sm"
              style={{ backgroundColor: "white", color: "black" }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
