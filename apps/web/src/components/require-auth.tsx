"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

// Wraps any page that needs a signed-in user — shows a loading state while
// the initial silent refresh runs, then redirects to /login if it turns out
// there's no session. Pages using this never render their real content for
// a logged-out visitor, even briefly.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-gray-600">Loading...</p>
      </main>
    );
  }

  return <>{children}</>;
}
