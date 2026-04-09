"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import {
  clearAdminKey,
  getAdminKey,
  hasAdminKey,
  setAdminKey,
} from "@/src/lib/admin-access";

function getAccessErrorCopy(errorCode: string | null) {
  if (errorCode === "admin-not-configured") {
    return "Admin access is not configured for this environment.";
  }

  if (errorCode === "admin-access-required") {
    return "Enter the operator access key to open alpha support tools.";
  }

  return "";
}

export default function AdminHomePage() {
  const router = useRouter();
  const [adminKey, setAdminKeyInput] = useState(() => getAdminKey());
  const [saved, setSaved] = useState(() => hasAdminKey());
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const search = typeof window === "undefined" ? "" : window.location.search;
    const params = new URLSearchParams(search);
    setAccessError(getAccessErrorCopy(params.get("error")));
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey.trim()) {
      return;
    }

    setAdminKey(adminKey.trim());
    setSaved(true);
    router.replace("/admin");
  }

  function handleClearAccess() {
    clearAdminKey();
    setAdminKeyInput("");
    setSaved(false);
    router.replace("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title="Alpha Operator Tools"
        subtitle="Use these tools to inspect learners, preview sessions, and deactivate bad items."
      />

      <form
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        onSubmit={handleSubmit}
      >
        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--text)]">
            Operator access key
          </span>
          <input
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--text)]"
            onChange={(event) => setAdminKeyInput(event.target.value)}
            placeholder="Enter alpha operator key"
            type="password"
            value={adminKey}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!adminKey.trim()}
            type="submit"
          >
            Save access key
          </button>
          {saved ? (
            <button
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text)]"
              onClick={handleClearAccess}
              type="button"
            >
              Clear access key
            </button>
          ) : null}
        </div>
      </form>

      {accessError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {accessError}
        </div>
      ) : null}

      {saved ? (
        <div className="grid gap-3">
          <Link
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)]"
            href="/admin/learners"
          >
            Learner lookup
          </Link>
          <Link
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)]"
            href="/admin/preview"
          >
            Session preview
          </Link>
          <Link
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)]"
            href="/admin/review"
          >
            Bad-item deactivation
          </Link>
        </div>
      ) : null}
    </main>
  );
}
