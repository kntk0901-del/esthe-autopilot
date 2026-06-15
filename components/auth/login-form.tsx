"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Supabase未設定のデモ環境では、そのままダッシュボードへ進む。
    if (!url || !key) {
      router.push("/dashboard");
      return;
    }
    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (error) {
      setMessage("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        管理者メール
        <span className="relative mt-2 block">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-[#858b86]" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-lg border bg-white pl-10 pr-3 font-normal"
            autoComplete="email"
            required
          />
        </span>
      </label>
      <label className="block text-sm font-semibold">
        パスワード
        <span className="relative mt-2 block">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-[#858b86]" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-lg border bg-white pl-10 pr-3 font-normal"
            autoComplete="current-password"
            required
          />
        </span>
      </label>
      <Button className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        ログイン
      </Button>
      {message ? (
        <p className="rounded-lg border bg-[#f6f3ed] p-3 text-xs text-[#626862]">
          {message}
        </p>
      ) : null}
    </form>
  );
}
