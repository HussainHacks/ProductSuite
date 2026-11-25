import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BarChart2,
  Kanban,
  List,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8003";

interface CommentItem {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
}

interface PlanTask {
  id: number;
  project_id: number;
  column_id: number;
  assignee_id: number | null;
  assignee_name: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  labels: string[];
  position: number;
  comments: CommentItem[];
}

interface BoardColumn {
  id: number;
  name: string;
  position: number;
  is_done_column: boolean;
}

interface Project {
  id: number;
  name: string;
  description: string;
  columns: BoardColumn[];
  tasks: PlanTask[];
  activities: { id: number; actor_name: string; summary: string; created_at: string }[];
}

interface Member {
  id: number;
  full_name: string;
  email: string;
}

const PRIORITY_BADGE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

function PlanForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("pf_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [view, setView] = useState<"board" | "list" | "overview">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newTaskTitleByCol, setNewTaskTitleByCol] = useState<Record<number, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    const [projRes, memRes] = await Promise.all([
      fetch(`${API_BASE}/api/projects`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/members`, { headers: authHeaders() }),
    ]);
    if (projRes.ok) {
      const data: Project[] = await projRes.json();
      setProjects(data);
      setSelectedProjectId((prev) => prev ?? data[0]?.id ?? null);
    }
    if (memRes.ok) setMembers(await memRes.json());
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadWorkspace();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadWorkspace]);

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="planforge"
          appName="PlanForge"
          accentClass="bg-emerald-600"
          user={null}
        />
        <AuthScreen
          appName="PlanForge"
          tagline="Visual project boards, task assignments, and team progress"
          accentClass="bg-emerald-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("pf_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  const project = projects.find((p) => p.id === selectedProjectId) ?? null;
  const activeTask = project?.tasks.find((t) => t.id === activeTaskId) ?? null;

  const filteredTasks = (project?.tasks ?? []).filter((t) => {
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.labels.some((l) => l.toLowerCase().includes(q))
      ) {
        return false;
      }
    }
    return true;
  });

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: newProjectName.trim(), description: "" }),
    });
    if (res.ok) {
      const created: Project = await res.json();
      setNewProjectName("");
      await loadWorkspace();
      setSelectedProjectId(created.id);
    }
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newColumnName.trim()) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/columns`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: newColumnName.trim() }),
    });
    setNewColumnName("");
    await loadWorkspace();
  }

  async function handleCreateTask(e: React.FormEvent, columnId: number) {
    e.preventDefault();
    if (!project) return;
    const title = (newTaskTitleByCol[columnId] || "").trim();
    if (!title) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/tasks`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ column_id: columnId, title }),
    });
    setNewTaskTitleByCol((prev) => ({ ...prev, [columnId]: "" }));
    await loadWorkspace();
  }

  async function handleMoveTask(taskId: number, targetColumnId: number) {
    if (!project) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/tasks/${taskId}/move`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ target_column_id: targetColumnId, position: 0 }),
    });
    await loadWorkspace();
  }

  async function handleUpdateTask(taskId: number, patch: Record<string, unknown>) {
    if (!project) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    await loadWorkspace();
  }

  async function handleDeleteTask(taskId: number) {
    if (!project) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/tasks/${taskId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setActiveTaskId(null);
    await loadWorkspace();
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !activeTask || !commentBody.trim()) return;
    await fetch(`${API_BASE}/api/projects/${project.id}/tasks/${activeTask.id}/comments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    setCommentBody("");
    await loadWorkspace();
  }

  const doneColumnIds = new Set(
    (project?.columns ?? []).filter((c) => c.is_done_column).map((c) => c.id),
  );
  const totalTasks = project?.tasks.length ?? 0;
  const doneTasks = (project?.tasks ?? []).filter((t) => doneColumnIds.has(t.column_id)).length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="planforge"
        appName="PlanForge"
        accentClass="bg-emerald-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("pf_token");
          setToken(null);
          setUser(null);
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              aria-label="Select project"
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"
            >
              {projects.length === 0 && <option value="">No projects yet</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <form onSubmit={handleCreateProject} className="flex gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name..."
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            </form>
          </div>

          {project && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "board", label: "Board", icon: Kanban },
                { id: "list", label: "List", icon: List },
                { id: "overview", label: "Overview", icon: BarChart2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id as "board" | "list" | "overview")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      view === item.id
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!project ? (
          <EmptyState
            icon={<Kanban className="h-6 w-6" />}
            title="Create your first project"
            description="Start a PlanForge project to organize tasks across Kanban columns, assign teammates, and track progress."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tasks by title or label..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {view === "board" && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {project.columns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.column_id === col.id);
                  return (
                    <div
                      key={col.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragTaskId !== null) {
                          handleMoveTask(dragTaskId, col.id);
                          setDragTaskId(null);
                        }
                      }}
                      className="w-80 shrink-0 rounded-2xl border border-slate-200 bg-slate-100/80 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="mb-3 flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {col.name}
                        </h3>
                        <Badge variant="neutral">{colTasks.length}</Badge>
                      </div>

                      <div className="space-y-2.5">
                        {colTasks.map((t) => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDragTaskId(t.id)}
                            onClick={() => setActiveTaskId(t.id)}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold">{t.title}</span>
                              <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                            </div>
                            {t.labels.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {t.labels.map((lbl) => (
                                  <span
                                    key={lbl}
                                    className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  >
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                              <span>{t.assignee_name || "Unassigned"}</span>
                              <span className="flex items-center gap-1">
                                {t.due_date && <span>{t.due_date}</span>}
                                {t.comments.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <MessageSquare className="h-3 w-3" /> {t.comments.length}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form
                        onSubmit={(e) => handleCreateTask(e, col.id)}
                        className="mt-3 flex gap-1.5"
                      >
                        <input
                          type="text"
                          value={newTaskTitleByCol[col.id] ?? ""}
                          onChange={(e) =>
                            setNewTaskTitleByCol((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          placeholder="Add task..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <button
                          type="submit"
                          aria-label={`Add task to ${col.name}`}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  );
                })}

                <form
                  onSubmit={handleAddColumn}
                  className="w-64 shrink-0 self-start rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-700"
                >
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="New column name..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-lg bg-slate-200 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    + Add Column
                  </button>
                </form>
              </div>
            )}

            {view === "list" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                    <tr>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3">Column</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Assignee</th>
                      <th className="px-4 py-3">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTasks.map((t) => {
                      const col = project.columns.find((c) => c.id === t.column_id);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setActiveTaskId(t.id)}
                          className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-3 font-medium">{t.title}</td>
                          <td className="px-4 py-3 text-slate-500">{col?.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {t.assignee_name || "Unassigned"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{t.due_date || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {view === "overview" && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                  <h3 className="text-base font-bold">Project Progress</h3>
                  <div>
                    <div className="mb-1 flex justify-between text-xs font-medium">
                      <span>Completion</span>
                      <span>
                        {doneTasks}/{totalTasks} ({progressPct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    {project.columns.map((c) => {
                      const count = project.tasks.filter((t) => t.column_id === c.id).length;
                      return (
                        <div key={c.id} className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{c.name}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <Activity className="h-4 w-4 text-emerald-600" /> Activity History
                  </h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
                    {project.activities.map((a) => (
                      <div
                        key={a.id}
                        className="border-b border-slate-100 pb-2 dark:border-slate-800"
                      >
                        <span className="font-semibold">{a.actor_name}</span> {a.summary}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {activeTask && project && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{activeTask.title}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteTask(activeTask.id)}
                  aria-label="Delete task"
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTaskId(null)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Column</label>
                <select
                  value={activeTask.column_id}
                  onChange={(e) => handleMoveTask(activeTask.id, Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {project.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Assignee</label>
                <select
                  value={activeTask.assignee_id ?? ""}
                  onChange={(e) =>
                    handleUpdateTask(
                      activeTask.id,
                      e.target.value
                        ? { assignee_id: Number(e.target.value) }
                        : { clear_assignee: true },
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              rows={3}
              value={activeTask.description}
              onChange={(e) =>
                handleUpdateTask(activeTask.id, { description: e.target.value })
              }
              placeholder="Task description..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-500">
                Comments ({activeTask.comments.length})
              </div>
              <div className="max-h-32 space-y-1.5 overflow-y-auto text-xs">
                {activeTask.comments.map((cm) => (
                  <div key={cm.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                    <span className="font-semibold">{cm.author_name}: </span>
                    {cm.body}
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PlanForgeWorkspace />
    </ThemeProvider>
  );
}
