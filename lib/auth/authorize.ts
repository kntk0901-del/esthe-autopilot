import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  adminEmails,
  getEnv,
  isSupabaseConfigured,
} from "@/lib/config/env";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "admin" | "viewer";
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedUser> {
  if (!isSupabaseConfigured()) {
    return { id: "demo-admin", email: "admin@example.com", role: "admin" };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let userId: string | undefined;
  let userEmail: string | undefined;
  if (token) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (!error) {
      userId = data.user.id;
      userEmail = data.user.email;
    }
  } else {
    const env = getEnv();
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("認証設定が不足しています");
    }
    const cookieStore = await cookies();
    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (items) => {
            items.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
    const { data, error } = await client.auth.getUser();
    if (!error) {
      userId = data.user.id;
      userEmail = data.user.email;
    }
  }
  if (!userId || !userEmail) {
    throw new Error("認証情報を確認できません");
  }
  const email = userEmail.toLowerCase();
  return {
    id: userId,
    email,
    role: adminEmails().includes(email) ? "admin" : "viewer",
  };
}

export async function requireAdmin(request: Request): Promise<AuthenticatedUser> {
  const user = await authenticateRequest(request);
  if (user.role !== "admin") {
    throw new Error("管理者権限が必要です");
  }
  return user;
}
