import React, { useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import type { Question } from "./types";

interface PublicFormViewProps {
  apiBaseUrl: string;
  slug?: string;
  previewForm?: {
    title: string;
    description: string;
    questions: Question[];
  };
}

export function PublicFormView({ apiBaseUrl, slug, previewForm }: PublicFormViewProps) {
  const [form, setForm] = useState<{
    title: string;
    description: string;
    questions: Question[];
  } | null>(previewForm ?? null);
  const [respondentLabel, setRespondentLabel] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(!previewForm);

  useEffect(() => {
    if (previewForm) {
      setForm(previewForm);
      setLoading(false);
      return;
    }
    if (!slug) return;
    setLoading(true);
    fetch(`${apiBaseUrl}/api/public/forms/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("This form is unavailable or unpublished.");
        return res.json();
      })
      .then((data) => setForm(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiBaseUrl, slug, previewForm]);

  function setAnswer(questionId: number, value: unknown) {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value }));
  }

  function toggleMultiChoice(questionId: number, option: string) {
    const key = String(questionId);
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    setAnswer(questionId, next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);

    for (const q of form.questions) {
      const val = answers[String(q.id)];
      const empty = val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
      if (q.required && empty) {
        setError(`Please answer required question: "${q.prompt}"`);
        return;
      }
    }

    if (previewForm) {
      setSubmitted(true);
      return;
    }

    const res = await fetch(`${apiBaseUrl}/api/public/forms/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respondent_label: respondentLabel.trim() || "Anonymous",
        answers,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setError(errData.detail || "Submission failed. Please check your answers.");
      return;
    }
    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Loading form...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {error || "Form not found."}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-indigo-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Response Recorded
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {previewForm
              ? "Preview submission verified (not saved to database)."
              : "Thank you for completing this form."}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="rounded-2xl border-t-4 border-t-indigo-600 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{form.title}</h1>
        {form.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{form.description}</p>
        )}
      </div>

      {!previewForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
            Your Name (optional)
          </label>
          <input
            type="text"
            value={respondentLabel}
            onChange={(e) => setRespondentLabel(e.target.value)}
            placeholder="Anonymous"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {form.questions.map((q) => {
        const val = answers[String(q.id)];
        return (
          <div
            key={q.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-white">
              {q.prompt}
              {q.required && <span className="ml-1 text-rose-500">*</span>}
            </label>

            {q.question_type === "short_text" && (
              <input
                type="text"
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {q.question_type === "long_text" && (
              <textarea
                rows={3}
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {q.question_type === "email" && (
              <input
                type="email"
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {q.question_type === "number" && (
              <input
                type="number"
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {q.question_type === "date" && (
              <input
                type="date"
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {q.question_type === "rating" && (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Rate ${star}`}
                    onClick={() => setAnswer(q.id, star)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                      Number(val) >= star
                        ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60"
                        : "border-slate-200 text-slate-400 hover:border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <Star className="h-5 w-5 fill-current" />
                  </button>
                ))}
              </div>
            )}

            {q.question_type === "dropdown" && (
              <select
                value={String(val ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select an option...</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {q.question_type === "single_choice" && (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={val === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      className="text-indigo-600"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.question_type === "multiple_choice" && (
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const selected = Array.isArray(val) && val.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMultiChoice(q.id, opt)}
                        className="rounded text-indigo-600"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Submit Response
        </button>
      </div>
    </form>
  );
}
