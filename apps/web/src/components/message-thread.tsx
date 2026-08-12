"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  contentType: string | null;
}

interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  sentVia: "app" | "email" | "system";
  readAt: string | null;
  flagged: boolean;
  createdAt: string;
  attachments: MessageAttachment[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function mergeMessage(list: MessageDto[], incoming: MessageDto): MessageDto[] {
  if (list.some((m) => m.id === incoming.id)) return list;
  return [...list, incoming];
}

export function MessageThread({ conversationId }: { conversationId: string }) {
  const { user, accessToken, authFetch } = useAuth();
  const [messages, setMessages] = useState<MessageDto[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initial history load.
  useEffect(() => {
    authFetch<MessageDto[]>(`/conversations/${conversationId}/messages`)
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load messages"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Live updates — connects once we have a token, joins this conversation's
  // room, and merges any broadcast message (including our own, echoed back)
  // into state, deduped by id against whatever the REST call already added.
  useEffect(() => {
    if (!accessToken) return;
    const socket = io(`${API_URL}/messaging`, { auth: { token: accessToken } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_conversation", { conversationId });
    });
    socket.on("message", (incoming: MessageDto) => {
      setMessages((prev) => (prev ? mergeMessage(prev, incoming) : [incoming]));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, accessToken]);

  // Mark any incoming (not-mine) unread message as read. Updates readAt
  // locally right away — otherwise every subsequent message arriving would
  // re-scan and re-POST for the same already-read messages indefinitely.
  useEffect(() => {
    if (!messages || !user) return;
    const unread = messages.filter((m) => m.senderId !== user.id && !m.readAt);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev
        ? prev.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, readAt: now } : m))
        : prev,
    );
    for (const m of unread) {
      authFetch(`/messages/${m.id}/read`, { method: "POST" }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await authFetch<MessageDto>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body: draft },
      });
      setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]));
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col rounded-lg border border-gray-200">
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4">
        {messages === null && !error && <p className="text-sm text-gray-600">Loading...</p>}
        {messages?.length === 0 && <p className="text-sm text-gray-600">No messages yet.</p>}
        {messages?.map((m) => (
          <div key={m.id} className={m.senderId === user.id ? "self-end text-right" : "self-start"}>
            <div
              className={
                "inline-block max-w-sm rounded-lg px-3 py-2 text-sm " +
                (m.senderId === user.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900")
              }
            >
              {m.body}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {m.sentVia === "email" ? "via email · " : ""}
              {new Date(m.createdAt).toLocaleString()}
              {m.flagged ? " · flagged for review" : ""}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p className="border-t border-gray-100 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
