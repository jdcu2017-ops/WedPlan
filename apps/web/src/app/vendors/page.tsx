"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { ApiError, apiRequest } from "@/lib/api-client";

interface VendorSearchItem {
  vendorId: string;
  businessName: string;
  categories: string[];
  serviceArea: string | null;
  bio: string | null;
  verificationStatus: string;
  avgRating: number;
  reviewCount: number;
  minPrice: number | null;
}

interface SearchResponse {
  items: VendorSearchItem[];
  page: number;
  pageSize: number;
  total: number;
}

export default function VendorsPage() {
  const [categories, setCategories] = useState("");
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "rating" | "price">("newest");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function runSearch(targetPage: number) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categories) params.set("categories", categories);
      if (location) params.set("location", location);
      if (search) params.set("search", search);
      params.set("sort", sort);
      params.set("page", String(targetPage));
      const data = await apiRequest<SearchResponse>(`/vendors?${params.toString()}`);
      setResult(data);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch(1);
    // Initial load only — subsequent searches are triggered by the form submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">Browse vendors</h1>

        <form onSubmit={handleSubmit} className="mb-8 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business name or bio"
            className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="Categories (e.g. venue, dj)"
            className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="price">Lowest price</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Search
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-600">Loading...</p>}

        {!loading && result && result.items.length === 0 && (
          <p className="text-sm text-gray-600">No vendors match those filters.</p>
        )}

        <div className="flex flex-col gap-4">
          {result?.items.map((vendor) => (
            <Link
              key={vendor.vendorId}
              href={`/vendors/${vendor.vendorId}`}
              className="rounded-lg border border-gray-200 p-4 hover:border-gray-400"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{vendor.businessName}</h2>
                  <p className="text-sm text-gray-600">
                    {vendor.categories.join(", ") || "Uncategorized"}
                    {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">
                    {vendor.avgRating.toFixed(1)} ★ ({vendor.reviewCount})
                  </p>
                  {vendor.minPrice !== null && (
                    <p className="text-gray-600">from ${vendor.minPrice.toLocaleString()}</p>
                  )}
                </div>
              </div>
              {vendor.bio && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{vendor.bio}</p>}
            </Link>
          ))}
        </div>

        {result && result.total > result.pageSize && (
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => runSearch(page - 1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => runSearch(page + 1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </>
  );
}
