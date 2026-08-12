"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface InquirerProfileDto {
  displayName: string;
  weddingDate: string | null;
  venueLocation: string | null;
  guestCount: number | null;
  budgetTotal: number | null;
  styleTags: string[];
}

interface VendorProfileDto {
  businessName: string;
  categories: string[];
  serviceArea: string | null;
  bio: string | null;
  verificationStatus: string;
  avgRating: number;
  reviewCount: number;
}

interface MeResponse {
  user: { id: string; email: string; role: "inquirer" | "vendor" | "admin"; mfaEnabled: boolean };
  profile: InquirerProfileDto | VendorProfileDto | null;
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <AppHeader />
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const { authFetch, user } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<MeResponse>("/users/me")
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile"));
    // authFetch is intentionally not memoized (see auth-context.tsx) — this
    // should only re-run when the page's own concerns change, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!me || !user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Your profile</h1>
      {user.role === "inquirer" ? (
        <InquirerProfileForm profile={me.profile as InquirerProfileDto | null} />
      ) : (
        <VendorProfileForm profile={me.profile as VendorProfileDto | null} />
      )}
    </main>
  );
}

function InquirerProfileForm({ profile }: { profile: InquirerProfileDto | null }) {
  const { authFetch } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [weddingDate, setWeddingDate] = useState(profile?.weddingDate ?? "");
  const [venueLocation, setVenueLocation] = useState(profile?.venueLocation ?? "");
  const [guestCount, setGuestCount] = useState(profile?.guestCount?.toString() ?? "");
  const [budgetTotal, setBudgetTotal] = useState(profile?.budgetTotal?.toString() ?? "");
  const [styleTags, setStyleTags] = useState(profile?.styleTags.join(", ") ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await authFetch("/users/me/inquirer-profile", {
        method: "PUT",
        body: {
          displayName,
          weddingDate: weddingDate || undefined,
          venueLocation: venueLocation || undefined,
          guestCount: guestCount ? Number(guestCount) : undefined,
          budgetTotal: budgetTotal ? Number(budgetTotal) : undefined,
          styleTags: styleTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Display name">
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <Field label="Wedding date">
        <input
          type="date"
          value={weddingDate ?? ""}
          onChange={(e) => setWeddingDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <Field label="Venue location">
        <input
          value={venueLocation ?? ""}
          onChange={(e) => setVenueLocation(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <Field label="Guest count">
        <input
          type="number"
          min={0}
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <Field label="Budget total">
        <input
          type="number"
          min={0}
          step="0.01"
          value={budgetTotal}
          onChange={(e) => setBudgetTotal(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <Field label="Style tags (comma-separated)">
        <input
          value={styleTags}
          onChange={(e) => setStyleTags(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </Field>
      <SaveButton status={status} error={error} />
    </form>
  );
}

function VendorProfileForm({ profile }: { profile: VendorProfileDto | null }) {
  const { authFetch } = useAuth();
  const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
  const [categories, setCategories] = useState(profile?.categories.join(", ") ?? "");
  const [serviceArea, setServiceArea] = useState(profile?.serviceArea ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await authFetch("/users/me/vendor-profile", {
        method: "PUT",
        body: {
          businessName,
          categories: categories
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          serviceArea: serviceArea || undefined,
          bio: bio || undefined,
        },
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {profile && (
        <div className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
          Verification: <span className="font-medium">{profile.verificationStatus}</span> ·{" "}
          {profile.reviewCount} review{profile.reviewCount === 1 ? "" : "s"} · avg rating{" "}
          {profile.avgRating.toFixed(1)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Business name">
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </Field>
        <Field label="Categories (comma-separated)">
          <input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="venue, catering, dj"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </Field>
        <Field label="Service area">
          <input
            value={serviceArea ?? ""}
            onChange={(e) => setServiceArea(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={4}
            value={bio ?? ""}
            onChange={(e) => setBio(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </Field>
        <SaveButton status={status} error={error} />
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function SaveButton({
  status,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
}) {
  return (
    <>
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-2 self-start rounded-md bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {status === "saving" ? "Saving..." : "Save"}
      </button>
    </>
  );
}
