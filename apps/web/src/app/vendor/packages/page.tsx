"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type PricingType = "flat" | "hourly" | "per_guest" | "tiered" | "custom_quote";

interface PackageAddon {
  id: string;
  name: string;
  price: number;
}

interface VendorPackage {
  id: string;
  name: string;
  category: string;
  description: string | null;
  pricingType: PricingType;
  basePrice: number | null;
  depositPct: number;
  cancellationPolicy: string | null;
  isActive: boolean;
  addons: PackageAddon[];
}

interface PackageFormValues {
  name: string;
  category: string;
  description: string;
  pricingType: PricingType;
  basePrice: string;
  depositPct: string;
  cancellationPolicy: string;
  isActive: boolean;
}

const EMPTY_FORM: PackageFormValues = {
  name: "",
  category: "",
  description: "",
  pricingType: "flat",
  basePrice: "",
  depositPct: "25",
  cancellationPolicy: "",
  isActive: true,
};

export default function VendorPackagesPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <PackagesContent />
    </RequireAuth>
  );
}

function PackagesContent() {
  const { user, authFetch } = useAuth();
  const [packages, setPackages] = useState<VendorPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await authFetch<VendorPackage[]>("/vendors/me/packages");
      setPackages(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load packages");
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your packages</h1>
        <button
          onClick={() => setCreating((c) => !c)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          {creating ? "Cancel" : "Add package"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {creating && (
        <div className="mb-8 rounded-lg border border-gray-200 p-4">
          <PackageForm
            initial={EMPTY_FORM}
            submitLabel="Create package"
            onSubmit={async (values) => {
              await authFetch("/vendors/me/packages", { method: "POST", body: toRequestBody(values) });
              setCreating(false);
              await load();
            }}
          />
        </div>
      )}

      {packages === null && !error && <p className="text-sm text-gray-600">Loading...</p>}
      {packages?.length === 0 && <p className="text-sm text-gray-600">No packages yet.</p>}

      <div className="flex flex-col gap-4">
        {packages?.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onChanged={load} />
        ))}
      </div>
    </main>
  );
}

function toRequestBody(values: PackageFormValues) {
  return {
    name: values.name,
    category: values.category,
    description: values.description || undefined,
    pricingType: values.pricingType,
    basePrice: values.basePrice ? Number(values.basePrice) : undefined,
    depositPct: values.depositPct ? Number(values.depositPct) : undefined,
    cancellationPolicy: values.cancellationPolicy || undefined,
    isActive: values.isActive,
  };
}

function PackageCard({ pkg, onChanged }: { pkg: VendorPackage; onChanged: () => Promise<void> }) {
  const { authFetch } = useAuth();
  const [editing, setEditing] = useState(false);
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete "${pkg.name}"?`)) return;
    try {
      await authFetch(`/vendors/me/packages/${pkg.id}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete package");
    }
  }

  async function handleAddAddon(e: FormEvent) {
    e.preventDefault();
    try {
      await authFetch(`/vendors/me/packages/${pkg.id}/addons`, {
        method: "POST",
        body: { name: addonName, price: Number(addonPrice) },
      });
      setAddonName("");
      setAddonPrice("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add add-on");
    }
  }

  async function handleRemoveAddon(addonId: string) {
    try {
      await authFetch(`/vendors/me/packages/${pkg.id}/addons/${addonId}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove add-on");
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <PackageForm
          initial={{
            name: pkg.name,
            category: pkg.category,
            description: pkg.description ?? "",
            pricingType: pkg.pricingType,
            basePrice: pkg.basePrice?.toString() ?? "",
            depositPct: pkg.depositPct.toString(),
            cancellationPolicy: pkg.cancellationPolicy ?? "",
            isActive: pkg.isActive,
          }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await authFetch(`/vendors/me/packages/${pkg.id}`, {
              method: "PUT",
              body: toRequestBody(values),
            });
            setEditing(false);
            await onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">
            {pkg.name} {!pkg.isActive && <span className="text-xs text-gray-400">(inactive)</span>}
          </h3>
          <p className="text-xs text-gray-500">{pkg.category}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setEditing(true)} className="text-gray-700 underline">
            Edit
          </button>
          <button onClick={handleDelete} className="text-red-600 underline">
            Delete
          </button>
        </div>
      </div>
      {pkg.description && <p className="mt-2 text-sm text-gray-700">{pkg.description}</p>}
      <p className="mt-2 text-sm">
        {pkg.basePrice !== null ? `$${pkg.basePrice.toLocaleString()}` : "Custom quote"} (
        {pkg.pricingType}) · Deposit {pkg.depositPct}%
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <h4 className="mb-2 text-sm font-medium">Add-ons</h4>
        {pkg.addons.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
        <ul className="mb-2 flex flex-col gap-1">
          {pkg.addons.map((addon) => (
            <li key={addon.id} className="flex items-center justify-between text-sm">
              <span>
                {addon.name} — ${addon.price.toLocaleString()}
              </span>
              <button onClick={() => handleRemoveAddon(addon.id)} className="text-red-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddAddon} className="flex gap-2">
          <input
            required
            placeholder="Add-on name"
            value={addonName}
            onChange={(e) => setAddonName(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            required
            type="number"
            min={0}
            step="0.01"
            placeholder="Price"
            value={addonPrice}
            onChange={(e) => setAddonPrice(e.target.value)}
            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded-md border border-gray-300 px-3 py-1 text-sm">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

function PackageForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PackageFormValues;
  submitLabel: string;
  onSubmit: (values: PackageFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save package");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-3">
        <input
          required
          placeholder="Name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Category"
          value={values.category}
          onChange={(e) => setValues({ ...values, category: e.target.value })}
          className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <textarea
        placeholder="Description"
        rows={2}
        value={values.description}
        onChange={(e) => setValues({ ...values, description: e.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-3">
        <select
          value={values.pricingType}
          onChange={(e) => setValues({ ...values, pricingType: e.target.value as PricingType })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="flat">Flat</option>
          <option value="hourly">Hourly</option>
          <option value="per_guest">Per guest</option>
          <option value="tiered">Tiered</option>
          <option value="custom_quote">Custom quote</option>
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Base price"
          value={values.basePrice}
          onChange={(e) => setValues({ ...values, basePrice: e.target.value })}
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          placeholder="Deposit %"
          value={values.depositPct}
          onChange={(e) => setValues({ ...values, depositPct: e.target.value })}
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <input
        placeholder="Cancellation policy"
        value={values.cancellationPolicy}
        onChange={(e) => setValues({ ...values, cancellationPolicy: e.target.value })}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues({ ...values, isActive: e.target.checked })}
        />
        Active (visible to inquirers)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
