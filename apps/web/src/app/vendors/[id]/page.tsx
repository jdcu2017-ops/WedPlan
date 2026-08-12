"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface VendorPackage {
  id: string;
  name: string;
  category: string;
  description: string | null;
  pricingType: string;
  basePrice: number | null;
  depositPct: number;
  cancellationPolicy: string | null;
}

interface VendorProfile {
  vendorId: string;
  businessName: string;
  categories: string[];
  serviceArea: string | null;
  bio: string | null;
  verificationStatus: string;
  avgRating: number;
  reviewCount: number;
  packages: VendorPackage[];
}

export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VendorProfile>(`/vendors/${params.id}`)
      .then(setVendor)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load vendor"));
  }, [params.id]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && !vendor && <p className="text-sm text-gray-600">Loading...</p>}
        {vendor && (
          <>
            <VendorHeader vendor={vendor} />
            <PackagesList packages={vendor.packages} />
            <InquiryPanel vendor={vendor} />
          </>
        )}
      </main>
    </>
  );
}

function VendorHeader({ vendor }: { vendor: VendorProfile }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold">{vendor.businessName}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {vendor.categories.join(", ") || "Uncategorized"}
        {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ""}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {vendor.avgRating.toFixed(1)} ★ ({vendor.reviewCount} review
        {vendor.reviewCount === 1 ? "" : "s"}) ·{" "}
        <span className="font-medium">{vendor.verificationStatus}</span>
      </p>
      {vendor.bio && <p className="mt-4 text-gray-800">{vendor.bio}</p>}
    </div>
  );
}

function PackagesList({ packages }: { packages: VendorPackage[] }) {
  if (packages.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Packages</h2>
      <div className="flex flex-col gap-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{pkg.name}</h3>
              {pkg.basePrice !== null && (
                <span className="text-sm font-medium">
                  ${pkg.basePrice.toLocaleString()}{" "}
                  <span className="font-normal text-gray-500">({pkg.pricingType})</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{pkg.category}</p>
            {pkg.description && <p className="mt-2 text-sm text-gray-700">{pkg.description}</p>}
            <p className="mt-2 text-xs text-gray-500">Deposit: {pkg.depositPct}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InquiryPanel({ vendor }: { vendor: VendorProfile }) {
  const { user, authFetch } = useAuth();
  const [category, setCategory] = useState(vendor.categories[0] ?? "");
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <p className="rounded-md bg-gray-100 px-4 py-3 text-sm text-gray-700">
        Log in as a couple to send this vendor an inquiry.
      </p>
    );
  }
  if (user.role !== "inquirer") {
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      await authFetch("/inquiries", {
        method: "POST",
        body: {
          vendorId: vendor.vendorId,
          category,
          eventDate: eventDate || undefined,
          message: message || undefined,
        },
      });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to send inquiry");
    }
  }

  if (status === "sent") {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
        Inquiry sent! The vendor will respond via messaging.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-lg font-semibold">Send an inquiry</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <input
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Event date (optional)
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Message (optional)
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="self-start rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Send inquiry"}
        </button>
      </form>
    </div>
  );
}
