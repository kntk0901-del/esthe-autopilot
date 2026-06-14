import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="fine-grid grid min-h-screen place-items-center bg-[#121c2b] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center text-white">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-white/5">
            <Sparkles className="h-6 w-6 text-[#ed9a88]" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
            Operations Console
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">
            Esthe Growth Autopilot
          </h1>
          <p className="mt-2 text-sm text-white/55">
            3店舗の投稿と売上を、ひとつの運用へ。
          </p>
        </div>
        <Card className="border-white/10">
          <CardContent className="p-7">
            <h2 className="font-serif text-xl font-semibold">管理画面へログイン</h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-[#6e746f]">
              Supabase未設定のデモ環境では、そのままダッシュボードへ進みます。
            </p>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
