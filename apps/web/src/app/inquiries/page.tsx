"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type InquiryStatus = "open" | "quoted" | "hold" | "contracted" | "declined" | "closed";

interface InquiryListItem {
  id: string;
  vendorBusinessName: string;
  inquirerDisplayName: string;
  category: string;
  eventDate: string | null;
  status: InquiryStatus;
  createdAt: string;
}

const STATUS_FILTERS: (InquiryStatus | "all")[] = [
  "all",
  "open",
  "quoted",
  "hold",
  "contracted",
  "declined",
  "closed",
];

export default function InquiriesPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <InquiriesContent />
    </RequireAuth>
  );
}

function InquiriesContent() {
  const { user, authFetch } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryListItem[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  async function load(filter: InquiryStatus | "all") {
    setError(null);
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const data = await authFetch<InquiryListItem[]>(`/inquiries${query}`);
      setInquiries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load inquiries");
    }
  }

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (!user) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {user.role === "inquirer" ? "Your inquiries" : "Inquiries received"}
      </h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={
              "rounded-full px-3 py-1 text-sm " +
              (statusFilter === s ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-700")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {inquiries === null && !error && <p className="text-sm text-gray-600">Loading...</p>}
      {inquiries?.length === 0 && <p className="text-sm text-gray-600">No inquiries here.</p>}

      <div className="flex flex-col gap-3">
        {inquiries?.map((inquiry) => (
          <Link
            key={inquiry.id}
            href={`/inquiries/${inquiry.id}`}
            className="rounded-lg border border-gray-200 p-4 hover:border-gray-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">
                  {user.role === "inquirer" ? inquiry.vendorBusinessName : inquiry.inquirerDisplayName}
                </h2>
                <p className="text-sm text-gray-600">
                  {inquiry.category}
                  {inquiry.eventDate ? ` · ${inquiry.eventDate}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {inquiry.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
