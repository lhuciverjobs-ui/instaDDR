import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useMailDetail } from "@/hooks/use-kuku";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface MailDetailProps {
  num: string | null;
  mailKey: string | null;
  subject: string;
  from: string;
  receivedAt: string;
  onClose: () => void;
}

export function MailDetail({ num, mailKey, subject, from, receivedAt, onClose }: MailDetailProps) {
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
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 border-l-border/40 shadow-2xl">
        <SheetHeader className="px-6 py-6 border-b border-border/40 bg-card/50 backdrop-blur-sm">
          <SheetTitle className="text-xl font-bold leading-tight">{subject || "Tanpa Subjek"}</SheetTitle>
          <SheetDescription className="flex flex-col gap-1 mt-2 text-sm">
            <span className="font-medium text-foreground">Dari: {from}</span>
            <span>Diterima: {formattedDate}</span>
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 relative bg-white overflow-hidden">
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
              srcDoc={data.html}
              sandbox=""
              title="Isi Email"
              className="w-full h-full border-0"
              style={{ backgroundColor: "white", color: "black" }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
