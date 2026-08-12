"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { MessageThread } from "@/components/message-thread";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type InquiryStatus = "open" | "quoted" | "hold" | "contracted" | "declined" | "closed";
type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

interface InquiryDetail {
  id: string;
  inquirerId: string;
  vendorId: string;
  vendorBusinessName: string;
  inquirerDisplayName: string;
  category: string;
  eventDate: string | null;
  status: InquiryStatus;
  createdAt: string;
  conversationId: string;
}

interface QuoteLineItem {
  label: string;
  amount: number;
}

interface Quote {
  id: string;
  inquiryId: string;
  lineItems: QuoteLineItem[];
  totalAmount: number;
  depositAmount: number;
  validUntil: string | null;
  status: QuoteStatus;
  createdAt: string;
}

export default function InquiryDetailPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <AppHeader />
      <InquiryDetailContent inquiryId={params.id} />
    </RequireAuth>
  );
}

function InquiryDetailContent({ inquiryId }: { inquiryId: string }) {
  const { user, authFetch } = useAuth();
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadInquiry() {
    try {
      const data = await authFetch<InquiryDetail>(`/inquiries/${inquiryId}`);
      setInquiry(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load inquiry");
    }
  }

  async function loadQuotes() {
    try {
      const data = await authFetch<Quote[]>(`/inquiries/${inquiryId}/quotes`);
      setQuotes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quotes");
    }
  }

  useEffect(() => {
    loadInquiry();
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  if (!user) return null;
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }
  if (!inquiry) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-600">Loading...</p>
      </main>
    );
  }

  const otherParty =
    user.role === "inquirer" ? inquiry.vendorBusinessName : inquiry.inquirerDisplayName;

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      await loadInquiry();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{otherParty}</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {inquiry.status}
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        {inquiry.category}
        {inquiry.eventDate ? ` · ${inquiry.eventDate}` : " · no event date set"}
      </p>

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {user.role === "inquirer" && (inquiry.status === "open" || inquiry.status === "quoted") && (
          <EventDateForm
            inquiryId={inquiryId}
            current={inquiry.eventDate}
            onSaved={loadInquiry}
          />
        )}
        {user.role === "vendor" && inquiry.status === "open" && (
          <button
            onClick={() => runAction(() => authFetch(`/inquiries/${inquiryId}/decline`, { method: "POST" }))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            Decline inquiry
          </button>
        )}
        {["open", "quoted", "hold"].includes(inquiry.status) && (
          <button
            onClick={() => runAction(() => authFetch(`/inquiries/${inquiryId}/close`, { method: "POST" }))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            Close inquiry
          </button>
        )}
      </div>

      <QuotesSection
        inquiry={inquiry}
        quotes={quotes}
        onChanged={async () => {
          await loadQuotes();
          await loadInquiry();
        }}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Messages</h2>
      <MessageThread conversationId={inquiry.conversationId} />
    </main>
  );
}

function EventDateForm({
  inquiryId,
  current,
  onSaved,
}: {
  inquiryId: string;
  current: string | null;
  onSaved: () => Promise<void>;
}) {
  const { authFetch } = useAuth();
  const [eventDate, setEventDate] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await authFetch(`/inquiries/${inquiryId}/event-date`, {
        method: "PATCH",
        body: { eventDate },
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to set event date");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="date"
        required
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
        Set event date
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}

function QuotesSection({
  inquiry,
  quotes,
  onChanged,
}: {
  inquiry: InquiryDetail;
  quotes: Quote[] | null;
  onChanged: () => Promise<void>;
}) {
  const { user, authFetch } = useAuth();
  const [creating, setCreating] = useState(false);

  if (!user) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quotes</h2>
        {user.role === "vendor" && (inquiry.status === "open" || inquiry.status === "quoted") && (
          <button
            onClick={() => setCreating((c) => !c)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            {creating ? "Cancel" : "New quote"}
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4 rounded-lg border border-gray-200 p-4">
          <QuoteForm
            submitLabel="Create draft"
            onSubmit={async (values) => {
              await authFetch(`/inquiries/${inquiry.id}/quotes`, {
                method: "POST",
                body: values,
              });
              setCreating(false);
              await onChanged();
            }}
          />
        </div>
      )}

      {quotes === null && <p className="text-sm text-gray-600">Loading quotes...</p>}
      {quotes?.length === 0 && <p className="text-sm text-gray-600">No quotes yet.</p>}

      <div className="flex flex-col gap-3">
        {quotes?.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function QuoteCard({ quote, onChanged }: { quote: Quote; onChanged: () => Promise<void> }) {
  const { user, authFetch } = useAuth();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function runAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <QuoteForm
          initial={{
            lineItems: quote.lineItems.map((li) => ({ label: li.label, amount: String(li.amount) })),
            depositAmount: String(quote.depositAmount),
            validUntil: quote.validUntil ?? "",
          }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await authFetch(`/quotes/${quote.id}`, { method: "PUT", body: values });
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
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{quote.status}</span>
        <span className="text-sm font-medium">${quote.totalAmount.toLocaleString()}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
        {quote.lineItems.map((li, i) => (
          <li key={i} className="flex justify-between">
            <span>{li.label}</span>
            <span>${li.amount.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">
        Deposit: ${quote.depositAmount.toLocaleString()}
        {quote.validUntil ? ` · Valid until ${quote.validUntil}` : ""}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2 text-sm">
        {user.role === "vendor" && quote.status === "draft" && (
          <>
            <button onClick={() => setEditing(true)} className="text-gray-700 underline">
              Edit
            </button>
            <button
              onClick={() => runAction(() => authFetch(`/quotes/${quote.id}/send`, { method: "POST" }))}
              className="text-gray-700 underline"
            >
              Send
            </button>
          </>
        )}
        {user.role === "inquirer" && quote.status === "sent" && (
          <>
            <button
              onClick={() => runAction(() => authFetch(`/quotes/${quote.id}/accept`, { method: "POST" }))}
              className="font-medium text-green-700 underline"
            >
              Accept
            </button>
            <button
              onClick={() => runAction(() => authFetch(`/quotes/${quote.id}/decline`, { method: "POST" }))}
              className="text-red-600 underline"
            >
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface QuoteFormValues {
  lineItems: { label: string; amount: string }[];
  depositAmount: string;
  validUntil: string;
}

const EMPTY_QUOTE_FORM: QuoteFormValues = {
  lineItems: [{ label: "", amount: "" }],
  depositAmount: "",
  validUntil: "",
};

function QuoteForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: QuoteFormValues;
  submitLabel: string;
  onSubmit: (values: { lineItems: QuoteLineItem[]; depositAmount: number; validUntil?: string }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<QuoteFormValues>(initial ?? EMPTY_QUOTE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLineItem(index: number, field: "label" | "amount", value: string) {
    const lineItems = values.lineItems.map((li, i) => (i === index ? { ...li, [field]: value } : li));
    setValues({ ...values, lineItems });
  }

  function addLineItem() {
    setValues({ ...values, lineItems: [...values.lineItems, { label: "", amount: "" }] });
  }

  function removeLineItem(index: number) {
    setValues({ ...values, lineItems: values.lineItems.filter((_, i) => i !== index) });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        lineItems: values.lineItems.map((li) => ({ label: li.label, amount: Number(li.amount) })),
        depositAmount: Number(values.depositAmount),
        validUntil: values.validUntil || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save quote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {values.lineItems.map((li, i) => (
          <div key={i} className="flex gap-2">
            <input
              required
              placeholder="Line item"
              value={li.label}
              onChange={(e) => updateLineItem(i, "label", e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="Amount"
              value={li.amount}
              onChange={(e) => updateLineItem(i, "amount", e.target.value)}
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {values.lineItems.length > 1 && (
              <button
                type="button"
                onClick={() => removeLineItem(i)}
                className="text-sm text-red-600 underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addLineItem} className="self-start text-sm text-gray-700 underline">
          + Add line item
        </button>
      </div>
      <div className="flex gap-3">
        <input
          required
          type="number"
          min={0}
          step="0.01"
          placeholder="Deposit amount"
          value={values.depositAmount}
          onChange={(e) => setValues({ ...values, depositAmount: e.target.value })}
          className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          placeholder="Valid until"
          value={values.validUntil}
          onChange={(e) => setValues({ ...values, validUntil: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
