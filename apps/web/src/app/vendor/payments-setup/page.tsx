"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface ConnectStatus {
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export default function VendorPaymentsSetupPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <PaymentsSetupContent />
    </RequireAuth>
  );
}

function PaymentsSetupContent() {
  const { user, authFetch } = useAuth();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    authFetch<ConnectStatus>("/payments/connect/status")
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load status"));
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

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await authFetch<{ url: string }>("/payments/connect/onboarding-link", {
        method: "POST",
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start onboarding");
      setConnecting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Payments setup</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!status && !error && <p className="text-sm text-gray-600">Loading...</p>}

      {status && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4 text-sm">
          <p>
            Onboarding:{" "}
            <span className="font-medium">{status.onboardingComplete ? "Complete" : "Incomplete"}</span>
          </p>
          <p>
            Can accept charges:{" "}
            <span className="font-medium">{status.chargesEnabled ? "Yes" : "No"}</span>
          </p>
          <p>
            Can receive payouts:{" "}
            <span className="font-medium">{status.payoutsEnabled ? "Yes" : "No"}</span>
          </p>
        </div>
      )}

      {status && !status.chargesEnabled && (
        <p className="mb-4 text-sm text-gray-600">
          You need to finish connecting Stripe before you can request deposits or payments from
          couples.
        </p>
      )}

      <button
        onClick={handleConnect}
        disabled={connecting}
        className="rounded-md bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {connecting
          ? "Redirecting to Stripe..."
          : status?.onboardingComplete
            ? "Update Stripe details"
            : "Connect with Stripe"}
      </button>
    </main>
  );
}
