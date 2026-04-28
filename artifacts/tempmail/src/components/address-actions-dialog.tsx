import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Mail,
  MessageSquare,
  QrCode,
  Lock,
  Copy,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import { setAddressAlias, getAddresses } from "@/lib/kuku";
import { useToast } from "@/hooks/use-toast";

type Mode = "menu" | "alias" | "qr" | "password";

interface AddressActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  onCopy: () => void;
  onCreateNew: () => void;
  onAliasChanged?: () => void;
}

const PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";

function generatePassword(length: number): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) {
    const v = arr[i];
    if (v === undefined) continue;
    out += PASSWORD_CHARS[v % PASSWORD_CHARS.length];
  }
  return out;
}

export function AddressActionsDialog({
  open,
  onOpenChange,
  address,
  onCopy,
  onCreateNew,
  onAliasChanged,
}: AddressActionsDialogProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [aliasValue, setAliasValue] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [passwordLength, setPasswordLength] = useState(16);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setMode("menu");
      const existing = getAddresses().find((a) => a.address === address);
      setAliasValue(existing?.alias ?? "");
      setQrDataUrl(null);
      setPassword("");
      setPasswordCopied(false);
    }
  }, [open, address]);

  useEffect(() => {
    if (mode !== "qr" || !address) return;
    QRCode.toDataURL(`mailto:${address}`, {
      width: 320,
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [mode, address]);

  useEffect(() => {
    if (mode === "alias") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (mode === "password" && !password) {
      setPassword(generatePassword(passwordLength));
    }
  }, [mode, password, passwordLength]);

  const handleSaveAlias = () => {
    setAddressAlias(address, aliasValue);
    onAliasChanged?.();
    toast({
      title: aliasValue.trim() ? "Alias disimpan" : "Alias dihapus",
      description: aliasValue.trim()
        ? `Alamat ditandai sebagai "${aliasValue.trim()}"`
        : "Alias telah dihapus",
    });
    setMode("menu");
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleRegeneratePassword = () => {
    setPassword(generatePassword(passwordLength));
    setPasswordCopied(false);
  };

  const renderHeader = () => (
    <div className="bg-foreground text-background px-5 py-4 rounded-md mb-3">
      <p className="text-sm leading-relaxed">
        Alamat email{" "}
        <span className="font-bold underline underline-offset-2 font-mono break-all">
          {address}
        </span>{" "}
        berhasil dibuat.
      </p>
    </div>
  );

  const ActionButton = ({
    icon: Icon,
    label,
    onClick,
    testId,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    testId: string;
  }) => (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-md border border-border bg-card hover:bg-accent transition-colors group"
    >
      <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-5 gap-0"
        data-testid="dialog-address-actions"
      >
        {mode === "menu" && (
          <>
            <DialogTitle className="sr-only">Tindakan untuk alamat email</DialogTitle>
            <DialogDescription className="sr-only">
              Pilih tindakan untuk alamat email yang baru dibuat
            </DialogDescription>
            {renderHeader()}
            <div className="space-y-2">
              <ActionButton
                icon={Pencil}
                label="Salin alamat"
                onClick={() => {
                  onCopy();
                }}
                testId="action-copy"
              />
              <ActionButton
                icon={Mail}
                label="Buat email baru"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(onCreateNew, 150);
                }}
                testId="action-create-new"
              />
              <ActionButton
                icon={MessageSquare}
                label="Tambahkan alias pada alamat"
                onClick={() => setMode("alias")}
                testId="action-alias"
              />
              <ActionButton
                icon={QrCode}
                label="Tampilkan kode QR"
                onClick={() => setMode("qr")}
                testId="action-qr"
              />
              <ActionButton
                icon={Lock}
                label="Hasilkan kata sandi acak"
                onClick={() => setMode("password")}
                testId="action-password"
              />
            </div>
            <div className="flex justify-end mt-5">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-actions"
              >
                Tutup
              </Button>
            </div>
          </>
        )}

        {mode === "alias" && (
          <>
            <DialogTitle className="text-lg mb-1">Tambahkan Alias</DialogTitle>
            <DialogDescription className="mb-4">
              Beri label pada alamat ini agar mudah diingat (mis. "untuk
              Twitter")
            </DialogDescription>
            <Input
              ref={inputRef}
              value={aliasValue}
              onChange={(e) => setAliasValue(e.target.value)}
              placeholder="mis. untuk Shopee"
              maxLength={48}
              data-testid="input-alias"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAlias();
              }}
            />
            <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
              {address}
            </p>
            <div className="flex justify-between mt-5 gap-2">
              <Button variant="ghost" onClick={() => setMode("menu")} data-testid="button-back-alias">
                <X className="w-4 h-4 mr-1.5" />
                Batal
              </Button>
              <Button onClick={handleSaveAlias} data-testid="button-save-alias">
                <Check className="w-4 h-4 mr-1.5" />
                Simpan
              </Button>
            </div>
          </>
        )}

        {mode === "qr" && (
          <>
            <DialogTitle className="text-lg mb-1">Kode QR</DialogTitle>
            <DialogDescription className="mb-4">
              Pindai kode untuk menyalin alamat email ke perangkat lain
            </DialogDescription>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="border border-border rounded-md p-3 bg-white">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Kode QR untuk ${address}`}
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-muted-foreground text-sm">
                    Membuat QR...
                  </div>
                )}
              </div>
              <p className="text-sm font-mono text-center break-all px-4">
                {address}
              </p>
            </div>
            <div className="flex justify-end mt-5 gap-2">
              <Button
                variant="outline"
                onClick={() => setMode("menu")}
                data-testid="button-back-qr"
              >
                Kembali
              </Button>
            </div>
          </>
        )}

        {mode === "password" && (
          <>
            <DialogTitle className="text-lg mb-1">Kata Sandi Acak</DialogTitle>
            <DialogDescription className="mb-4">
              Kata sandi kuat yang dibuat di perangkat Anda — tidak dikirim ke server
            </DialogDescription>
            <div className="border border-border rounded-md p-4 bg-muted/40 font-mono text-base break-all min-h-[60px] flex items-center" data-testid="text-password">
              {password}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-muted-foreground shrink-0">
                Panjang
              </label>
              <input
                type="range"
                min="8"
                max="48"
                value={passwordLength}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPasswordLength(n);
                  setPassword(generatePassword(n));
                  setPasswordCopied(false);
                }}
                className="flex-1 accent-foreground"
                data-testid="input-password-length"
              />
              <span className="text-sm font-mono w-8 text-right">{passwordLength}</span>
            </div>
            <div className="flex justify-between mt-5 gap-2">
              <Button
                variant="ghost"
                onClick={() => setMode("menu")}
                data-testid="button-back-password"
              >
                Kembali
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRegeneratePassword}
                  data-testid="button-regen-password"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Acak Lagi
                </Button>
                <Button onClick={handleCopyPassword} data-testid="button-copy-password">
                  {passwordCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1.5" />
                      Salin
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
