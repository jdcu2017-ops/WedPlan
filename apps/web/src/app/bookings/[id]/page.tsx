"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { StripeCheckoutForm } from "@/components/stripe-checkout-form";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type BookingStatus = "hold" | "contracted" | "deposit_paid" | "confirmed" | "completed" | "cancelled";
type PaymentType = "deposit" | "milestone" | "final";
type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

interface BookingDetail {
  id: string;
  quoteId: string;
  inquirerId: string;
  vendorId: string;
  vendorBusinessName: string;
  inquirerDisplayName: string;
  eventDate: string;
  status: BookingStatus;
  contractDocUrl: string | null;
  totalAmount: number;
  depositPaidAt: string | null;
  balanceDueAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  type: PaymentType | "refund";
  status: PaymentStatus;
  createdAt: string;
  clientSecret?: string | null;
}

const CANCELLABLE_STATUSES: BookingStatus[] = ["hold", "contracted", "deposit_paid", "confirmed"];

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <AppHeader />
      <BookingDetailContent bookingId={params.id} />
    </RequireAuth>
  );
}

function BookingDetailContent({ bookingId }: { bookingId: string }) {
  const { user, authFetch } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBooking() {
    try {
      setBooking(await authFetch<BookingDetail>(`/bookings/${bookingId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load booking");
    }
  }

  async function loadPayments() {
    try {
      setPayments(await authFetch<Payment[]>(`/bookings/${bookingId}/payments`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load payments");
    }
  }

  useEffect(() => {
    loadBooking();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (!user) return null;
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }
  if (!booking) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-600">Loading...</p>
      </main>
    );
  }

  const otherParty = user.role === "inquirer" ? booking.vendorBusinessName : booking.inquirerDisplayName;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{otherParty}</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {booking.status.replace("_", " ")}
        </span>
      </div>
      <p className="mb-1 text-sm text-gray-600">Event date: {booking.eventDate}</p>
      <p className="mb-1 text-sm text-gray-600">Total: ${booking.totalAmount.toLocaleString()}</p>
      {booking.contractDocUrl && (
        <p className="mb-1 text-sm">
          <a href={booking.contractDocUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
            View contract
          </a>
        </p>
      )}
      {booking.cancelledAt && (
        <p className="mb-1 text-sm text-red-600">
          Cancelled: {booking.cancellationReason ?? "No reason given"}
        </p>
      )}

      {CANCELLABLE_STATUSES.includes(booking.status) && (
        <CancelBookingButton bookingId={bookingId} onCancelled={loadBooking} />
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Payments</h2>

      {user.role === "vendor" && booking.status !== "cancelled" && (
        <RequestPaymentForm
          bookingId={bookingId}
          onRequested={async () => {
            await loadPayments();
          }}
        />
      )}

      {payments === null && <p className="text-sm text-gray-600">Loading payments...</p>}
      {payments?.length === 0 && <p className="text-sm text-gray-600">No payments requested yet.</p>}

      <div className="mt-4 flex flex-col gap-3">
        {payments?.map((payment) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            onChanged={async () => {
              await loadPayments();
              await loadBooking();
            }}
          />
        ))}
      </div>
    </main>
  );
}

function CancelBookingButton({
  bookingId,
  onCancelled,
}: {
  bookingId: string;
  onCancelled: () => Promise<void>;
}) {
  const { authFetch } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    const reason = window.prompt("Reason for cancelling this booking?");
    if (!reason) return;
    setError(null);
    try {
      await authFetch(`/bookings/${bookingId}/cancel`, { method: "POST", body: { reason } });
      await onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel booking");
    }
  }

  return (
    <div className="mb-2">
      <button onClick={handleCancel} className="text-sm text-red-600 underline">
        Cancel booking
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function RequestPaymentForm({
  bookingId,
  onRequested,
}: {
  bookingId: string;
  onRequested: () => Promise<void>;
}) {
  const { authFetch } = useAuth();
  const [type, setType] = useState<PaymentType>("deposit");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authFetch(`/bookings/${bookingId}/payments`, {
        method: "POST",
        body: { type, amount: type === "deposit" ? undefined : Number(amount) },
      });
      setAmount("");
      await onRequested();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PaymentType)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="deposit">Deposit</option>
          <option value="milestone">Milestone</option>
          <option value="final">Final</option>
        </select>
      </label>
      {type !== "deposit" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Amount
          <input
            required
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {submitting ? "Requesting..." : "Request payment"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

function PaymentCard({ payment, onChanged }: { payment: Payment; onChanged: () => Promise<void> }) {
  const { user, authFetch } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleRefund() {
    const reason = window.prompt("Reason for this refund? (optional)") ?? undefined;
    setError(null);
    try {
      await authFetch(`/payments/${payment.id}/refund`, { method: "POST", body: { reason } });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to issue refund");
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{payment.type}</span>
        <span className="text-sm">${payment.amount.toLocaleString()}</span>
      </div>
      <p className="text-xs text-gray-500">
        {payment.status} · {new Date(payment.createdAt).toLocaleDateString()}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {user.role === "inquirer" && payment.status === "pending" && payment.clientSecret && (
        <div className="mt-3">
          {paying ? (
            <StripeCheckoutForm
              clientSecret={payment.clientSecret}
              onSuccess={async () => {
                setPaying(false);
                await onChanged();
              }}
            />
          ) : (
            <button
              onClick={() => setPaying(true)}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Pay now
            </button>
          )}
        </div>
      )}

      {user.role === "vendor" && payment.status === "succeeded" && payment.type !== "refund" && (
        <button onClick={handleRefund} className="mt-3 text-sm text-red-600 underline">
          Issue refund
        </button>
      )}
    </div>
  );
}
