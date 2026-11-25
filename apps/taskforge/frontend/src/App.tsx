import React, { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  History,
  Inbox,
  ListTodo,
  Plus,
  Repeat,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8002";

export type Priority = "low" | "medium" | "high" | "urgent";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
type ViewMode = "today" | "upcoming" | "all" | "completed" | "list";

export interface TaskList {
  id: number;
  name: string;
  color: string;
  task_count: number;
}

export interface TaskItem {
  id: number;
  list_id: number | null;
  title: string;
  notes: string;
  priority: Priority;
  due_date: string | null;
  recurrence: Recurrence;
  is_completed: boolean;
  completed_at: string | null;
}

const PRIORITY_BADGE: Record<Priority, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export function TaskForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("tf_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [view, setView] = useState<ViewMode>("today");
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [newListName, setNewListName] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<Priority>("medium");

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams({
      view,
      include_completed: String(view === "completed" ? true : showCompleted),
    });
    if (view === "list" && activeListId !== null) params.set("list_id", String(activeListId));
    if (priorityFilter) params.set("priority", priorityFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    const [listsRes, tasksRes] = await Promise.all([
      fetch(`${API_BASE}/api/lists`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/tasks?${params.toString()}`, { headers: authHeaders() }),
    ]);
    if (listsRes.ok) setLists(await listsRes.json());
    if (tasksRes.ok) setTasks(await tasksRes.json());
  }, [token, view, activeListId, priorityFilter, searchQuery, showCompleted, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (u) => {
        if (!u) {
          setToken(null);
          return;
        }
        setUser(u);
        const prefRes = await fetch(`${API_BASE}/api/preferences`, { headers: authHeaders() });
        if (prefRes.ok) {
          const pref = await prefRes.json();
          setView(pref.default_view);
          setShowCompleted(pref.show_completed);
          setDefaultPriority(pref.default_priority);
        }
      });
  }, [token, authHeaders]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="taskforge"
          appName="TaskForge"
          accentClass="bg-sky-600"
          user={null}
        />
        <AuthScreen
          appName="TaskForge"
          tagline="Focus on today, plan what's next, and organize your lists"
          accentClass="bg-sky-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("tf_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: quickTitle.trim(),
        list_id: view === "list" ? activeListId : null,
        due_date: view === "today" ? todayStr : null,
        priority: defaultPriority,
      }),
    });
    setQuickTitle("");
    await loadData();
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    await fetch(`${API_BASE}/api/lists`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: newListName.trim(), color: "sky" }),
    });
    setNewListName("");
    await loadData();
  }

  async function handleToggleComplete(task: TaskItem) {
    const endpoint = task.is_completed
      ? `/api/tasks/${task.id}/reopen`
      : `/api/tasks/${task.id}/complete`;
    await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: authHeaders() });
    await loadData();
  }

  async function handleUpdateTask(taskId: number, patch: Record<string, unknown>) {
    await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    await loadData();
  }

  async function handleDeleteTask(taskId: number) {
    await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setSelectedTaskId(null);
    await loadData();
  }

  async function handleToggleShowCompleted() {
    const next = !showCompleted;
    setShowCompleted(next);
    await fetch(`${API_BASE}/api/preferences`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ show_completed: next }),
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="taskforge"
        appName="TaskForge"
        accentClass="bg-sky-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("tf_token");
          setToken(null);
          setUser(null);
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-5">
          <nav className="space-y-1">
            {[
              { id: "today", label: "Today", icon: Sun },
              { id: "upcoming", label: "Upcoming", icon: Calendar },
              { id: "all", label: "All Tasks", icon: Inbox },
              { id: "completed", label: "Completed History", icon: History },
            ].map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id as ViewMode);
                    setActiveListId(null);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-sky-600 text-white"
                      : "text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Custom Lists
            </div>
            <div className="space-y-1">
              {lists.map((lst) => (
                <button
                  key={lst.id}
                  type="button"
                  onClick={() => {
                    setView("list");
                    setActiveListId(lst.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                    view === "list" && activeListId === lst.id
                      ? "bg-sky-100 font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <ListTodo className="h-4 w-4 text-sky-600" />
                    {lst.name}
                  </span>
                  <span className="text-xs text-slate-400">{lst.task_count}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateList} className="mt-3 flex gap-1.5">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list..."
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="submit"
                aria-label="Add list"
                className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </aside>

        <main className="lg:col-span-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quick add a task..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Add
            </button>
          </form>

          {view !== "completed" && (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={handleToggleShowCompleted}
              />
              Show completed tasks
            </label>
          )}

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="No tasks in this view"
                description="Use the quick add bar above to capture your next task."
              />
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                    selectedTask?.id === t.id
                      ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(t);
                      }}
                      aria-label={t.is_completed ? "Reopen task" : "Complete task"}
                      className="text-sky-600"
                    >
                      {t.is_completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-400 hover:text-sky-600" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div
                        className={`truncate text-sm font-medium ${
                          t.is_completed ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {t.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        {t.due_date && <span>Due {t.due_date}</span>}
                        {t.recurrence !== "none" && (
                          <span className="inline-flex items-center gap-0.5">
                            <Repeat className="h-3 w-3" /> {t.recurrence}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                </div>
              ))
            )}
          </div>
        </main>

        <section className="lg:col-span-4">
          {selectedTask ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-500">Task Details</h3>
                <button
                  type="button"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  aria-label="Delete task"
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <input
                type="text"
                value={selectedTask.title}
                onChange={(e) => handleUpdateTask(selectedTask.id, { title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, { priority: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Due Date</label>
                  <input
                    type="date"
                    value={selectedTask.due_date ?? ""}
                    onChange={(e) =>
                      handleUpdateTask(
                        selectedTask.id,
                        e.target.value
                          ? { due_date: e.target.value }
                          : { clear_due_date: true },
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Recurrence</label>
                  <select
                    value={selectedTask.recurrence}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, { recurrence: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">List</label>
                  <select
                    value={selectedTask.list_id ?? ""}
                    onChange={(e) =>
                      handleUpdateTask(
                        selectedTask.id,
                        e.target.value
                          ? { list_id: Number(e.target.value) }
                          : { clear_list: true },
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">No List</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
                <textarea
                  rows={4}
                  value={selectedTask.notes}
                  onChange={(e) => handleUpdateTask(selectedTask.id, { notes: e.target.value })}
                  placeholder="Add notes or context..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ListTodo className="h-6 w-6" />}
              title="Select a task"
              description="Click any task to inspect or edit its notes, priority, due date, and recurrence."
            />
          )}
        </section>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TaskForgeWorkspace />
    </ThemeProvider>
  );
}
