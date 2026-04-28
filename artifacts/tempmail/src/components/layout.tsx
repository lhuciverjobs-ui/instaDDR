import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Mail } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto h-14 flex items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-lg">InstaMail</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              href="/"
              className={`transition-colors hover:text-foreground ${
                location === "/" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Kotak Masuk
            </Link>
            <Link
              href="/about"
              className={`transition-colors hover:text-foreground ${
                location === "/about" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Tentang
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-border/40 py-6 mt-auto">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground">
          <p>InstaMail — Layanan email sementara. Email akan dihapus otomatis setelah 30 hari.</p>
        </div>
      </footer>
    </div>
  );
}
