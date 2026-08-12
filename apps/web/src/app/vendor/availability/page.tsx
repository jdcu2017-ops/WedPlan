"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface AvailabilitySlot {
  date: string;
  status: "open" | "tentative_hold" | "booked" | "blocked";
  notes: string | null;
  holdExpiresAt: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function VendorAvailabilityPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <AvailabilityContent />
    </RequireAuth>
  );
}

function AvailabilityContent() {
  const { user, authFetch } = useAuth();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDaysIso(60));
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState<"open" | "blocked">("blocked");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await authFetch<AvailabilitySlot[]>(
        `/vendors/me/availability?from=${from}&to=${to}`,
      );
      setSlots(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load availability");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;
  if (user.role !== "vendor") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-gray-600">This page is only available to vendor accounts.</p>
      </main>
    );
  }

  async function handleRangeSubmit(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function setDateStatus(targetDate: string, targetStatus: "open" | "blocked", targetNotes?: string) {
    setSaving(true);
    setSaveError(null);
    try {
      await authFetch("/vendors/me/availability", {
        method: "PUT",
        body: { date: targetDate, status: targetStatus, notes: targetNotes || undefined },
      });
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to update availability");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetSubmit(e: FormEvent) {
    e.preventDefault();
    await setDateStatus(date, status, notes);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Availability calendar</h1>
      <p className="mb-6 text-sm text-gray-600">
        Dates not listed below are assumed open. Dates on hold or booked from an active booking
        can&apos;t be changed here directly.
      </p>

      <div className="mb-8 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Set a date</h2>
        <form onSubmit={handleSetSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "open" | "blocked")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="open">Open</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Notes (optional)
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
      </div>

      <form onSubmit={handleRangeSubmit} className="mb-4 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 text-sm">
          Refresh
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {slots === null && !error && <p className="text-sm text-gray-600">Loading...</p>}
      {slots?.length === 0 && (
        <p className="text-sm text-gray-600">No exceptions in this range — everything is open.</p>
      )}

      <ul className="flex flex-col divide-y divide-gray-100">
        {slots?.map((slot) => (
          <li key={slot.date} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium">{slot.date}</span>{" "}
              <span
                className={
                  slot.status === "blocked"
                    ? "text-red-600"
                    : slot.status === "open"
                      ? "text-green-700"
                      : "text-amber-600"
                }
              >
                {slot.status}
              </span>
              {slot.notes && <span className="ml-2 text-gray-500">— {slot.notes}</span>}
            </div>
            {(slot.status === "open" || slot.status === "blocked") && (
              <button
                onClick={() => setDateStatus(slot.date, slot.status === "open" ? "blocked" : "open")}
                className="text-gray-700 underline"
              >
                Mark {slot.status === "open" ? "blocked" : "open"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
