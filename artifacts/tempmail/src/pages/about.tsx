import { Card, CardContent } from "@/components/ui/card";

export default function About() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Tentang InstaMail</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          InstaMail adalah layanan email sementara (disposable email) yang dirancang untuk menjaga privasi Anda. Gunakan alamat email dari InstaMail saat mendaftar di layanan yang tidak Anda percayai untuk menghindari spam di kotak masuk utama Anda.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Bagaimana Cara Kerjanya?</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Klik "Buat Email Baru" untuk mendapatkan alamat email acak secara instan.</li>
              <li>Salin alamat tersebut dan gunakan untuk mendaftar di situs web atau aplikasi apa pun.</li>
              <li>Tunggu email masuk. Kotak masuk akan diperbarui secara otomatis setiap beberapa detik.</li>
              <li>Setelah selesai, Anda bisa membiarkannya. Email dan alamat akan dihapus secara otomatis.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 bg-secondary/30">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Kebijakan & Privasi</h2>
            <p className="text-muted-foreground">
              Demi keamanan dan kenyamanan bersama:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Semua email yang masuk akan dihapus secara otomatis setelah 30 hari.</li>
              <li>Layanan ini hanya untuk menerima email. Anda tidak dapat mengirim email dari alamat ini.</li>
              <li>Mohon jangan gunakan layanan ini untuk mendaftar akun penting seperti perbankan atau layanan utama Anda.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
