import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8005";

type FieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "single_select"
  | "multiple_select"
  | "email"
  | "url";

interface ListColumn {
  id: number;
  key: string;
  name: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
}

interface DataList {
  id: number;
  name: string;
  description: string;
  columns: ListColumn[];
  record_count: number;
}

interface ListRecord {
  id: number;
  list_id: number;
  values: Record<string, unknown>;
}

function DataForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("df_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lists, setLists] = useState<DataList[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [records, setRecords] = useState<ListRecord[]>([]);

  const [newListName, setNewListName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [colName, setColName] = useState("");
  const [colType, setColType] = useState<FieldType>("text");
  const [colOptions, setColOptions] = useState("Option 1, Option 2");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [draftRecord, setDraftRecord] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadLists = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/lists`, { headers: authHeaders() });
    if (res.ok) {
      const data: DataList[] = await res.json();
      setLists(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    }
  }, [token, authHeaders]);

  const loadRecords = useCallback(async () => {
    if (!token || !selectedId) return;
    const params = new URLSearchParams({ sort_dir: sortDir });
    if (search.trim()) params.set("q", search.trim());
    if (sortBy) params.set("sort_by", sortBy);
    const res = await fetch(`${API_BASE}/api/lists/${selectedId}/records?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (res.ok) setRecords(await res.json());
  }, [token, selectedId, search, sortBy, sortDir, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadLists();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadLists]);

  useEffect(() => {
    if (user && selectedId) loadRecords();
  }, [user, selectedId, loadRecords]);

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="dataforge"
          appName="DataForge"
          accentClass="bg-amber-600"
          user={null}
        />
        <AuthScreen
          appName="DataForge"
          tagline="Flexible structured lists, custom fields, and CSV workflows"
          accentClass="bg-amber-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("df_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  const activeList = lists.find((l) => l.id === selectedId) ?? null;

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const res = await fetch(`${API_BASE}/api/lists`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: newListName.trim(),
        template: newTemplate || null,
      }),
    });
    if (res.ok) {
      const created: DataList = await res.json();
      setNewListName("");
      setNewTemplate("");
      await loadLists();
      setSelectedId(created.id);
    }
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!activeList || !colName.trim()) return;
    const needsOpts = colType === "single_select" || colType === "multiple_select";
    await fetch(`${API_BASE}/api/lists/${activeList.id}/columns`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: colName.trim(),
        field_type: colType,
        options: needsOpts ? colOptions.split(",").map((s) => s.trim()).filter(Boolean) : [],
      }),
    });
    setColName("");
    await loadLists();
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!activeList) return;
    setError(null);
    const res = await fetch(`${API_BASE}/api/lists/${activeList.id}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ values: draftRecord }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "Validation error.");
      return;
    }
    setDraftRecord({});
    await loadRecords();
    await loadLists();
  }

  async function handleDeleteRecord(recordId: number) {
    if (!activeList) return;
    await fetch(`${API_BASE}/api/lists/${activeList.id}/records/${recordId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await loadRecords();
  }

  async function handleExportCsv() {
    if (!activeList) return;
    const res = await fetch(`${API_BASE}/api/lists/${activeList.id}/export.csv`, {
      headers: authHeaders(),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeList.name.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeList || !e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    await fetch(`${API_BASE}/api/lists/${activeList.id}/import.csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    await loadRecords();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="dataforge"
        appName="DataForge"
        accentClass="bg-amber-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("df_token");
          setToken(null);
          setUser(null);
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-4">
          <form onSubmit={handleCreateList} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New list name..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Blank List</option>
              <option value="issue_tracker">Template: Issue Tracker</option>
              <option value="asset_inventory">Template: Asset Inventory</option>
              <option value="event_contacts">Template: Event Contacts</option>
            </select>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              <Plus className="h-3.5 w-3.5" /> Create List
            </button>
          </form>

          <div className="space-y-1.5">
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  l.id === activeList?.id
                    ? "border-amber-500 bg-amber-50/70 font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="truncate">{l.name}</span>
                <Badge variant="neutral">{l.record_count}</Badge>
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-5">
          {!activeList ? (
            <EmptyState
              icon={<Table2 className="h-6 w-6" />}
              title="No list selected"
              description="Create a blank list or choose a template from the sidebar."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <h2 className="text-lg font-bold">{activeList.name}</h2>
                  <p className="text-xs text-slate-500">
                    {activeList.columns.length} columns · {records.length} records
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700">
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                    <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleAddColumn}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <input
                  type="text"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="New column name..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={colType}
                  onChange={(e) => setColType(e.target.value as FieldType)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                  <option value="single_select">Single Select</option>
                  <option value="multiple_select">Multiple Select</option>
                  <option value="email">Email</option>
                  <option value="url">URL</option>
                </select>
                {(colType === "single_select" || colType === "multiple_select") && (
                  <input
                    type="text"
                    value={colOptions}
                    onChange={(e) => setColOptions(e.target.value)}
                    placeholder="Comma options"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-700"
                >
                  + Add Column
                </button>
              </form>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search records..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {activeList.columns.length > 0 && (
                <form
                  onSubmit={handleAddRecord}
                  className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  {activeList.columns.map((c) => (
                    <div key={c.id} className="min-w-[140px] flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        {c.name}
                      </label>
                      {c.field_type === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(draftRecord[c.key])}
                          onChange={(e) =>
                            setDraftRecord((p) => ({ ...p, [c.key]: e.target.checked }))
                          }
                        />
                      ) : c.field_type === "single_select" ? (
                        <select
                          value={String(draftRecord[c.key] ?? "")}
                          onChange={(e) =>
                            setDraftRecord((p) => ({ ...p, [c.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">Select...</option>
                          {c.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            c.field_type === "number"
                              ? "number"
                              : c.field_type === "date"
                                ? "date"
                                : "text"
                          }
                          value={String(draftRecord[c.key] ?? "")}
                          onChange={(e) =>
                            setDraftRecord((p) => ({ ...p, [c.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Add Row
                  </button>
                </form>
              )}

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                    <tr>
                      {activeList.columns.map((c) => (
                        <th key={c.id} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortBy === c.key) {
                                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                              } else {
                                setSortBy(c.key);
                                setSortDir("asc");
                              }
                            }}
                            className="inline-flex items-center gap-1 font-semibold"
                          >
                            {c.name} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {records.map((r) => (
                      <tr key={r.id}>
                        {activeList.columns.map((c) => {
                          const v = r.values[c.key];
                          return (
                            <td key={c.id} className="px-4 py-2.5">
                              {Array.isArray(v)
                                ? v.join(", ")
                                : typeof v === "boolean"
                                  ? v
                                    ? "Yes"
                                    : "No"
                                  : String(v ?? "—")}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(r.id)}
                            aria-label="Delete row"
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataForgeWorkspace />
    </ThemeProvider>
  );
}
