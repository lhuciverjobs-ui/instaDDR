import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Check, AlertCircle, Shuffle, ExternalLink } from "lucide-react";
import { useDomains } from "@/hooks/use-kuku";

interface CreateAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (options: { domain?: string; username?: string }) => void;
  isPending: boolean;
  errorMessage?: string | null;
}

export function CreateAddressDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
  errorMessage,
}: CreateAddressDialogProps) {
  const { data: domains, isLoading, isError, error, refetch } = useDomains();
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
      setUsername("");
      setSelectedDomain(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!domains) return [];
    const q = search.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => d.domain.toLowerCase().includes(q));
  }, [domains, search]);

  const usernameValid =
    username === "" || /^[a-z0-9._-]{1,32}$/i.test(username);
  const domainErrorMessage =
    error instanceof Error ? error.message : "Gagal memuat daftar domain";
  const verificationBlocked =
    isError && /turnstile|verifikasi|cloudflare/i.test(domainErrorMessage);

  const handleCreate = (mode: "random" | "selected") => {
    if (mode === "random") {
      onCreate({});
      return;
    }
    if (!selectedDomain) return;
    onCreate({
      domain: selectedDomain,
      username: username.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden"
        data-testid="dialog-create-address"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-xl">Buat Email Sementara</DialogTitle>
          <DialogDescription>
            Pilih domain dan nama pengguna sesuai keinginan, atau buat secara
            acak.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 space-y-3 shrink-0">
          <div>
            <Label htmlFor="username-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nama Pengguna (Opsional)
            </Label>
            <Input
              id="username-input"
              data-testid="input-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Kosongkan untuk acak"
              className="mt-1.5 font-mono"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
            />
            {!usernameValid && (
              <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Hanya huruf, angka, titik, garis bawah, dan tanda hubung
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pilih Domain
            </Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-domain"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari domain..."
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-[200px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="h-full flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-sm">
                {domainErrorMessage}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {verificationBlocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://m.kuku.lu/", "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka Kuku.lu
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Coba Lagi
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Tidak ada domain cocok
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
              {filtered.map((d) => {
                const active = selectedDomain === d.domain;
                return (
                  <button
                    key={d.domain}
                    data-testid={`button-domain-${d.domain}`}
                    onClick={() => setSelectedDomain(d.domain)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-accent border-border hover:border-accent-foreground/20"
                    }`}
                  >
                    <span className="font-mono text-sm truncate">
                      @{d.domain}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.isNew && (
                        <Badge
                          variant={active ? "secondary" : "default"}
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          BARU
                        </Badge>
                      )}
                      {active && <Check className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="px-6 py-2 shrink-0">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20 shrink-0 flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            data-testid="button-create-random"
            onClick={() => handleCreate("random")}
            disabled={isPending || verificationBlocked}
            className="sm:mr-auto"
            title={verificationBlocked ? "Kuku.lu meminta verifikasi manual dulu" : undefined}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Shuffle className="w-4 h-4 mr-2" />
            )}
            Acak Saja
          </Button>
          <Button
            data-testid="button-create-selected"
            onClick={() => handleCreate("selected")}
            disabled={isPending || !selectedDomain || !usernameValid}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Buat Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
