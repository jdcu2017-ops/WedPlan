"use client";

import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
      <p className="text-sm text-gray-600">
        Signed in as <span className="font-medium">{user.role}</span>
      </p>
      <p className="mt-8 text-sm text-gray-500">
        This is a placeholder dashboard — vendor browse, inquiries, messaging, bookings, payments,
        and the checklist all still need their own pages here.
      </p>
    </main>
  );
}
