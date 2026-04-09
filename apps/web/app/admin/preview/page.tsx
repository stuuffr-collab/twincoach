"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import {
  ApiError,
  fetchAdminSessionPreview,
  type AdminSessionPreview,
} from "@/src/lib/api";
import { hasAdminKey } from "@/src/lib/admin-access";

export default function AdminPreviewPage() {
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState<AdminSessionPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPreview(nextSessionId: string) {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchAdminSessionPreview(nextSessionId);
      setResult(payload);
      setSessionId(nextSessionId);
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(fetchError.message);
      } else {
        setError("Unable to load session preview.");
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const search = typeof window === "undefined" ? "" : window.location.search;
    const initialSessionId = new URLSearchParams(search).get("sessionId");

    if (!initialSessionId || !hasAdminKey()) {
      return;
    }

    void loadPreview(initialSessionId);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionId.trim() || loading) {
      return;
    }

    await loadPreview(sessionId.trim());
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title="Session Preview"
        subtitle="Inspect committed session items and slot balance before investigating alpha issues."
      />

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]"
          onChange={(event) => setSessionId(event.target.value)}
          placeholder="Enter sessionId"
          value={sessionId}
        />
        <button
          className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading || !sessionId.trim()}
          type="submit"
        >
          {loading ? "Loading..." : "Load preview"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm font-semibold text-[var(--text)]">
            {result.sessionType} session
          </div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            Status: {result.status} | Position: {result.currentIndex}/{result.totalItems}
          </div>
          <div className="mt-4 grid gap-2">
            {result.items.map((item) => (
              <div
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                key={item.sessionItemId}
              >
                <div className="font-medium">
                  #{item.sequenceOrder} · {item.slotType}
                </div>
                <div className="text-[var(--text-muted)]">
                  {item.questionItemId} · {item.topicId} · {item.isActive ? "active" : "deactivated"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
