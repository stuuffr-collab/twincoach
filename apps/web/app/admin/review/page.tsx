"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import { ApiError, deactivateAdminItem } from "@/src/lib/api";
import { hasAdminKey } from "@/src/lib/admin-access";

export default function AdminReviewPage() {
  const [questionItemId, setQuestionItemId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAdminKey()) {
      setError("Admin access key required. Return to /admin first.");
      setSuccess("");
      return;
    }

    if (!questionItemId.trim() || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = await deactivateAdminItem(questionItemId.trim());
      setSuccess(`${payload.questionItemId} deactivated.`);
      setQuestionItemId("");
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError("Unable to deactivate item.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title="Bad-Item Deactivation"
        subtitle="Deactivate one question item immediately if it is unsafe for alpha learners."
      />

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]"
          onChange={(event) => setQuestionItemId(event.target.value)}
          placeholder="Enter questionItemId"
          value={questionItemId}
        />
        <button
          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading || !questionItemId.trim()}
          type="submit"
        >
          {loading ? "Deactivating..." : "Deactivate item"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}
    </main>
  );
}
