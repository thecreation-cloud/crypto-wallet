"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }: { error: unknown }) => {
        if (!error) router.replace("/");
        else router.replace("/?auth_error=1");
      });
    } else {
      // Implicit flow — Supabase puts tokens in the hash; getSession() processes them
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
        if (session) router.replace("/");
        else router.replace("/?auth_error=1");
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Verifying your identity…</p>
      </div>
    </div>
  );
}
