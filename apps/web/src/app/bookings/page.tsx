"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type BookingStatus = "hold" | "contracted" | "deposit_paid" | "confirmed" | "completed" | "cancelled";

interface BookingListItem {
  id: string;
  vendorBusinessName: string;
  inquirerDisplayName: string;
  eventDate: string;
  status: BookingStatus;
  totalAmount: number;
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  hold: "bg-amber-100 text-amber-800",
  contracted: "bg-blue-100 text-blue-800",
  deposit_paid: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

export default function BookingsPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <BookingsContent />
    </RequireAuth>
  );
}

function BookingsContent() {
  const { user, authFetch } = useAuth();
  const [bookings, setBookings] = useState<BookingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<BookingListItem[]>("/bookings")
      .then(setBookings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load bookings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Bookings</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {bookings === null && !error && <p className="text-sm text-gray-600">Loading...</p>}
      {bookings?.length === 0 && <p className="text-sm text-gray-600">No bookings yet.</p>}

      <div className="flex flex-col gap-3">
        {bookings?.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="rounded-lg border border-gray-200 p-4 hover:border-gray-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">
                  {user.role === "inquirer" ? booking.vendorBusinessName : booking.inquirerDisplayName}
                </h2>
                <p className="text-sm text-gray-600">
                  {booking.eventDate} · ${booking.totalAmount.toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[booking.status]}`}
              >
                {booking.status.replace("_", " ")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
