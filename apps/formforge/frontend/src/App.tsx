import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  Download,
  Eye,
  FileText,
  Globe,
  Plus,
  Trash2,
} from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";
import { PublicFormView } from "./PublicFormView";
import {
  QUESTION_TYPE_LABELS,
  type FormItem,
  type FormResponseItem,
  type FormSummary,
  type QuestionType,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";

function FormForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("ff_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<"builder" | "preview" | "responses">("builder");
  const [responses, setResponses] = useState<FormResponseItem[]>([]);
  const [summary, setSummary] = useState<FormSummary | null>(null);
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newType, setNewType] = useState<QuestionType>("short_text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("Option A, Option B");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const publicSlug = new URLSearchParams(window.location.search).get("public");

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadForms = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/forms`, { headers: authHeaders() });
    if (res.status === 401) {
      setToken(null);
      window.localStorage.removeItem("ff_token");
      return;
    }
    const data: FormItem[] = await res.json();
    setForms(data);
    setSelectedId((prev) => prev ?? data[0]?.id ?? null);
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadForms();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadForms]);

  const selectedForm = forms.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedForm || tab !== "responses" || !token) return;
    Promise.all([
      fetch(`${API_BASE}/api/forms/${selectedForm.id}/responses`, { headers: authHeaders() }).then(
        (r) => r.json(),
      ),
      fetch(`${API_BASE}/api/forms/${selectedForm.id}/summary`, { headers: authHeaders() }).then(
        (r) => r.json(),
      ),
    ]).then(([respData, sumData]) => {
      setResponses(respData);
      setSummary(sumData);
    });
  }, [selectedForm, tab, token, authHeaders]);

  if (publicSlug) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <AppHeader
          currentAppId="formforge"
          appName="FormForge"
          accentClass="bg-indigo-600"
          user={null}
        />
        <PublicFormView apiBaseUrl={API_BASE} slug={publicSlug} />
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="formforge"
          appName="FormForge"
          accentClass="bg-indigo-600"
          user={null}
        />
        <AuthScreen
          appName="FormForge"
          tagline="Build forms, collect responses, analyze insights"
          accentClass="bg-indigo-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("ff_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  async function handleCreateForm(e: React.FormEvent) {
    e.preventDefault();
    if (!newFormTitle.trim()) return;
    const res = await fetch(`${API_BASE}/api/forms`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: newFormTitle.trim(), description: "" }),
    });
    if (res.ok) {
      const created: FormItem = await res.json();
      setNewFormTitle("");
      await loadForms();
      setSelectedId(created.id);
    }
  }

  async function handleDeleteForm(formId: number) {
    await fetch(`${API_BASE}/api/forms/${formId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setSelectedId(null);
    await loadForms();
  }

  async function handleTogglePublish(form: FormItem) {
    await fetch(`${API_BASE}/api/forms/${form.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_published: !form.is_published }),
    });
    await loadForms();
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedForm || !newPrompt.trim()) return;
    const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(newType);
    const options = needsOptions
      ? newOptions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const res = await fetch(`${API_BASE}/api/forms/${selectedForm.id}/questions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        prompt: newPrompt.trim(),
        question_type: newType,
        required: newRequired,
        options,
      }),
    });
    if (res.ok) {
      setNewPrompt("");
      setNewRequired(false);
      await loadForms();
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!selectedForm) return;
    await fetch(`${API_BASE}/api/forms/${selectedForm.id}/questions/${questionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await loadForms();
  }

  async function handleMoveQuestion(index: number, direction: -1 | 1) {
    if (!selectedForm) return;
    const ids = selectedForm.questions.map((q) => q.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch(`${API_BASE}/api/forms/${selectedForm.id}/questions/reorder`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ question_ids: ids }),
    });
    await loadForms();
  }

  async function handleExportCsv() {
    if (!selectedForm) return;
    const res = await fetch(`${API_BASE}/api/forms/${selectedForm.id}/export.csv`, {
      headers: authHeaders(),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-${selectedForm.id}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyPublicUrl(slug: string) {
    const url = `${window.location.origin}/?public=${slug}`;
    navigator.clipboard?.writeText(url);
    setStatusMsg("Public form link copied to clipboard.");
    setTimeout(() => setStatusMsg(null), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="formforge"
        appName="FormForge"
        accentClass="bg-indigo-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("ff_token");
          setToken(null);
          setUser(null);
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-4">
          <form onSubmit={handleCreateForm} className="flex gap-2">
            <input
              type="text"
              value={newFormTitle}
              onChange={(e) => setNewFormTitle(e.target.value)}
              placeholder="New form title..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              aria-label="Create form"
              className="flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          <div className="space-y-1.5">
            {forms.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  f.id === selectedForm?.id
                    ? "border-indigo-500 bg-indigo-50/70 font-semibold text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="truncate">{f.title}</span>
                <Badge variant={f.is_published ? "success" : "neutral"}>
                  {f.is_published ? "Live" : "Draft"}
                </Badge>
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-9">
          {!selectedForm ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No form selected"
              description="Create a new form from the sidebar to add questions, publish, and collect responses."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedForm.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedForm.questions.length} questions · {selectedForm.response_count}{" "}
                    responses
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(selectedForm)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      selectedForm.is_published
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {selectedForm.is_published ? "Published" : "Publish Form"}
                  </button>

                  {selectedForm.is_published && (
                    <button
                      type="button"
                      onClick={() => copyPublicUrl(selectedForm.public_slug)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteForm(selectedForm.id)}
                    aria-label="Delete form"
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {statusMsg && (
                <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {statusMsg}
                </div>
              )}

              <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTab("builder")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    tab === "builder"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="h-4 w-4" /> Builder
                </button>
                <button
                  type="button"
                  onClick={() => setTab("preview")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    tab === "preview"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => setTab("responses")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    tab === "responses"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" /> Responses ({selectedForm.response_count})
                </button>
              </div>

              {tab === "builder" && (
                <div className="space-y-4">
                  {selectedForm.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {q.prompt}
                          </span>
                          {q.required && <Badge variant="danger">Required</Badge>}
                          <Badge variant="info">{QUESTION_TYPE_LABELS[q.question_type]}</Badge>
                        </div>
                        {q.options.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Options: {q.options.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(idx, 1)}
                          disabled={idx === selectedForm.questions.length - 1}
                          aria-label="Move down"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          aria-label="Remove question"
                          className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <form
                    onSubmit={handleAddQuestion}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Add Question
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        required
                        value={newPrompt}
                        onChange={(e) => setNewPrompt(e.target.value)}
                        placeholder="Question prompt..."
                        className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as QuestionType)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {["single_choice", "multiple_choice", "dropdown"].includes(newType) && (
                      <input
                        type="text"
                        value={newOptions}
                        onChange={(e) => setNewOptions(e.target.value)}
                        placeholder="Comma-separated options (e.g. Yes, No, Maybe)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={newRequired}
                          onChange={(e) => setNewRequired(e.target.checked)}
                        />
                        Required question
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4" /> Add Question
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {tab === "preview" && (
                <PublicFormView
                  apiBaseUrl={API_BASE}
                  previewForm={{
                    title: selectedForm.title,
                    description: selectedForm.description,
                    questions: selectedForm.questions,
                  }}
                />
              )}

              {tab === "responses" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Response Summary ({summary?.total_responses ?? responses.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                  </div>

                  {summary && summary.questions.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {summary.questions.map((qs) => (
                        <div
                          key={qs.question_id}
                          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="text-sm font-semibold">{qs.prompt}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {qs.total_answers} answers
                            {qs.average_rating !== null && ` · Avg Rating: ${qs.average_rating}/5`}
                          </div>
                          {Object.keys(qs.breakdown).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(qs.breakdown).map(([opt, count]) => (
                                <div key={opt} className="flex justify-between text-xs">
                                  <span>{opt}</span>
                                  <span className="font-semibold">{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {responses.length === 0 ? (
                    <EmptyState
                      icon={<BarChart3 className="h-6 w-6" />}
                      title="No responses yet"
                      description="Publish your form and share the link to start collecting responses."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-2.5">Respondent</th>
                            {selectedForm.questions.map((q) => (
                              <th key={q.id} className="px-4 py-2.5">
                                {q.prompt}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {responses.map((r) => (
                            <tr key={r.id}>
                              <td className="px-4 py-2.5 font-medium">{r.respondent_label}</td>
                              {selectedForm.questions.map((q) => {
                                const v = r.answers[String(q.id)];
                                return (
                                  <td key={q.id} className="px-4 py-2.5">
                                    {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FormForgeWorkspace />
    </ThemeProvider>
  );
}
