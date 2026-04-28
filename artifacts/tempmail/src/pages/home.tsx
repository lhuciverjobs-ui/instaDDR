import { useState, useEffect } from "react";
import { useKukuInit, useGenerateAddress, useInbox } from "@/hooks/use-kuku";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, RefreshCw, Plus, Check, Inbox, ChevronRight, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { MailDetail } from "@/components/mail-detail";
import { CreateAddressDialog } from "@/components/create-address-dialog";
import { AddressActionsDialog } from "@/components/address-actions-dialog";

export default function Home() {
  const { ready, addresses, updateAddresses } = useKukuInit();
  const [selectedAddress, setSelectedAddress] = useState<string | undefined>();
  const [isCopied, setIsCopied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsAddress, setActionsAddress] = useState<string | null>(null);
  const { toast } = useToast();

  const [selectedMail, setSelectedMail] = useState<{ num: string; key: string; subject: string; from: string; receivedAt: string } | null>(null);

  useEffect(() => {
    if (ready && addresses.length > 0 && !selectedAddress) {
      setSelectedAddress(addresses[0].address);
    }
  }, [ready, addresses, selectedAddress]);

  const { mutate: generate, isPending: isGenerating } = useGenerateAddress((newAddr) => {
    updateAddresses();
    setSelectedAddress(newAddr.address);
    setCreateOpen(false);
    setCreateError(null);
    setActionsAddress(newAddr.address);
    setActionsOpen(true);
  });

  const handleCreate = (options: { domain?: string; username?: string }) => {
    setCreateError(null);
    generate(options, {
      onError: (err) => {
        setCreateError(err instanceof Error ? err.message : "Gagal membuat email");
      },
    });
  };

  const openCreateDialog = () => {
    setCreateError(null);
    setCreateOpen(true);
  };

  const { data: inboxData, isFetching: isPolling, refetch } = useInbox(selectedAddress);

  const handleCopy = () => {
    if (!selectedAddress) return;
    navigator.clipboard.writeText(selectedAddress);
    setIsCopied(true);
    toast({
      title: "Berhasil disalin",
      description: "Alamat email telah disalin ke clipboard.",
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!ready) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <>
        <div className="h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <MailIcon className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Selamat Datang di InstaMail</h1>
          <p className="text-muted-foreground max-w-md mb-8 text-lg">
            Hindari spam dan jaga privasi Anda. Buat alamat email sementara secara instan untuk mendaftar di situs yang tidak Anda percayai.
          </p>
          <Button
            size="lg"
            className="h-14 px-8 text-lg rounded-full"
            onClick={openCreateDialog}
            data-testid="button-create-empty"
          >
            <Plus className="w-5 h-5 mr-2" />
            Buat Email Baru
          </Button>
        </div>
        <CreateAddressDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={handleCreate}
          isPending={isGenerating}
          errorMessage={createError}
        />
        {actionsAddress && (
          <AddressActionsDialog
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            address={actionsAddress}
            onCopy={() => {
              navigator.clipboard.writeText(actionsAddress);
              toast({
                title: "Berhasil disalin",
                description: "Alamat email telah disalin.",
              });
            }}
            onCreateNew={openCreateDialog}
            onAliasChanged={updateAddresses}
          />
        )}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-6 items-start">
      {/* Sidebar - Saved Addresses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Email Tersimpan</h2>
        </div>
        <div className="flex flex-col gap-2">
          {addresses.map((addr) => {
            const active = selectedAddress === addr.address;
            return (
              <div
                key={addr.address}
                className={`rounded-xl border transition-all duration-200 flex items-stretch ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card hover:bg-accent border-border text-foreground"
                }`}
              >
                <button
                  onClick={() => setSelectedAddress(addr.address)}
                  className="flex-1 text-left px-4 py-3 min-w-0"
                  data-testid={`button-select-${addr.address}`}
                >
                  {addr.alias && (
                    <div
                      className={`text-xs font-semibold truncate mb-0.5 ${
                        active ? "text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {addr.alias}
                    </div>
                  )}
                  <div className="truncate font-mono text-sm font-medium">
                    {addr.address}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      active
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(addr.createdAt), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionsAddress(addr.address);
                    setActionsOpen(true);
                  }}
                  className={`shrink-0 px-2.5 flex items-center justify-center rounded-r-xl transition-colors ${
                    active
                      ? "hover:bg-primary-foreground/15"
                      : "hover:bg-accent-foreground/10"
                  }`}
                  aria-label="Tindakan lainnya"
                  data-testid={`button-actions-${addr.address}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          className="w-full mt-4 border-dashed"
          onClick={openCreateDialog}
          disabled={isGenerating}
          data-testid="button-add-address"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Alamat
        </Button>
      </div>

      {/* Main Inbox Area */}
      <div className="flex flex-col gap-6">
        {/* Header Card */}
        <Card className="p-6 md:p-8 bg-card border-border/50 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              Alamat Email Anda
              {isPolling && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-2xl md:text-3xl font-mono font-bold tracking-tight text-foreground truncate bg-muted/50 px-4 py-2 rounded-lg border border-border/50 select-all">
                {selectedAddress}
              </div>
              <div className="flex items-center gap-2">
                <Button variant={isCopied ? "default" : "secondary"} size="icon" onClick={handleCopy} className="h-12 w-12 rounded-xl transition-all" data-testid="button-copy-main">
                  {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => refetch()} className="h-12 w-12 rounded-xl bg-card" data-testid="button-refresh">
                  <RefreshCw className={`w-5 h-5 ${isPolling ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (!selectedAddress) return;
                    setActionsAddress(selectedAddress);
                    setActionsOpen(true);
                  }}
                  className="h-12 w-12 rounded-xl bg-card"
                  data-testid="button-more-actions"
                  aria-label="Tindakan lainnya"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Otomatis menyegarkan. Email akan dihapus setelah 30 hari.
            </p>
          </div>
        </Card>

        {/* Inbox List */}
        <div className="flex-1 min-h-[400px] border border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-border/40 bg-muted/20 flex justify-between items-center">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              Kotak Masuk
            </h3>
            {inboxData?.count !== undefined && (
              <span className="text-sm font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                {inboxData.count} Pesan
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {(!inboxData || inboxData.empty || inboxData.mails.length === 0) ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground p-8 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-lg font-medium text-foreground">Belum ada email masuk</p>
                <p className="mt-1">Menunggu email untuk alamat ini...</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                <AnimatePresence>
                  {inboxData.mails.map((mail) => {
                    let formattedDate = "Baru saja";
                    if (mail.receivedAt) {
                      try {
                        formattedDate = format(new Date(mail.receivedAt), "p", { locale: id });
                      } catch { }
                    }

                    return (
                      <motion.button
                        key={mail.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => setSelectedMail({ num: mail.num, key: mail.key, subject: mail.subject, from: mail.from, receivedAt: mail.receivedAt })}
                        className="w-full text-left p-4 sm:p-6 hover:bg-accent/50 transition-colors flex items-start gap-4 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold">
                          {mail.from.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-foreground truncate">{mail.from}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formattedDate}</span>
                          </div>
                          <h4 className={`font-medium text-sm mb-1 truncate ${mail.unread ? "text-foreground" : "text-muted-foreground"}`}>
                            {mail.subject || "Tanpa Subjek"}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {mail.preview || "Tidak ada pratinjau..."}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0 text-muted-foreground">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      <MailDetail
        num={selectedMail?.num || null}
        mailKey={selectedMail?.key || null}
        subject={selectedMail?.subject || ""}
        from={selectedMail?.from || ""}
        receivedAt={selectedMail?.receivedAt || ""}
        onClose={() => setSelectedMail(null)}
      />

      <CreateAddressDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        isPending={isGenerating}
        errorMessage={createError}
      />

      {actionsAddress && (
        <AddressActionsDialog
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          address={actionsAddress}
          onCopy={() => {
            navigator.clipboard.writeText(actionsAddress);
            setIsCopied(true);
            toast({
              title: "Berhasil disalin",
              description: "Alamat email telah disalin.",
            });
            setTimeout(() => setIsCopied(false), 2000);
          }}
          onCreateNew={openCreateDialog}
          onAliasChanged={updateAddresses}
        />
      )}
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
