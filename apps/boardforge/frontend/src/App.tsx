import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle as CircleIcon,
  Download,
  Hand,
  Minus,
  MousePointer,
  PenTool,
  Plus,
  Redo2,
  Save,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppHeader, AuthScreen, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8006";

type ToolKind = "select" | "pan" | "sticky" | "text" | "rect" | "circle" | "connector" | "draw";

interface BoardElement {
  id: string;
  kind: "sticky" | "text" | "rect" | "circle" | "connector" | "stroke";
  x: number;
  y: number;
  width: number;
  height: number;
  x2?: number;
  y2?: number;
  text: string;
  color: string;
  points: number[][];
}

interface BoardItem {
  id: number;
  title: string;
  version: number;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  elements: BoardElement[];
}

const PALETTE = ["#FEF08A", "#BFDBFE", "#BBF7D0", "#FECDD3", "#E9D5FF", "#E2E8F0"];

function BoardForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("wb_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  const [elements, setElements] = useState<BoardElement[]>([]);
  const [history, setHistory] = useState<BoardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<BoardElement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolKind>("select");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const dragRef = useRef<{
    mode: "pan" | "move" | "draw" | "connect" | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    targetId?: string;
  }>({ mode: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadBoards = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/boards`, { headers: authHeaders() });
    if (res.ok) {
      const data: BoardItem[] = await res.json();
      setBoards(data);
      if (data.length > 0 && activeBoardId === null) {
        setActiveBoardId(data[0].id);
        setElements(data[0].elements);
        setPan({ x: data[0].viewport_x, y: data[0].viewport_y });
        setZoom(data[0].viewport_zoom);
      }
    }
  }, [token, authHeaders, activeBoardId]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadBoards();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadBoards]);

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="boardforge"
          appName="BoardForge"
          accentClass="bg-rose-600"
          user={null}
        />
        <AuthScreen
          appName="BoardForge"
          tagline="Infinite visual canvas for diagrams, notes, and brainstorming"
          accentClass="bg-rose-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("wb_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  function pushHistory(nextElements: BoardElement[]) {
    setHistory((h) => [...h.slice(-30), elements]);
    setRedoStack([]);
    setElements(nextElements);
  }

  function handleUndo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, elements]);
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, elements]);
    setRedoStack((r) => r.slice(0, -1));
    setElements(next);
  }

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;
    const res = await fetch(`${API_BASE}/api/boards`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: newBoardTitle.trim() }),
    });
    if (res.ok) {
      const created: BoardItem = await res.json();
      setNewBoardTitle("");
      await loadBoards();
      setActiveBoardId(created.id);
      setElements([]);
      setHistory([]);
      setRedoStack([]);
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  }

  function selectBoard(id: number) {
    const b = boards.find((item) => item.id === id);
    if (!b) return;
    setActiveBoardId(b.id);
    setElements(b.elements);
    setPan({ x: b.viewport_x, y: b.viewport_y });
    setZoom(b.viewport_zoom);
    setHistory([]);
    setRedoStack([]);
    setSelectedId(null);
  }

  async function handleSaveBoard() {
    if (!activeBoardId) return;
    const res = await fetch(`${API_BASE}/api/boards/${activeBoardId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        viewport_x: pan.x,
        viewport_y: pan.y,
        viewport_zoom: zoom,
        elements,
      }),
    });
    if (res.ok) {
      await loadBoards();
      setSavedBanner("Board saved");
      setTimeout(() => setSavedBanner(null), 2000);
    }
  }

  function clientToWorld(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  }

  function handleCanvasMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const world = clientToWorld(e.clientX, e.clientY);
    if (tool === "pan") {
      dragRef.current = {
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      };
      return;
    }

    if (tool === "sticky" || tool === "text" || tool === "rect" || tool === "circle") {
      const id = `el-${Date.now()}`;
      const newEl: BoardElement = {
        id,
        kind: tool,
        x: world.x - 80,
        y: world.y - 50,
        width: tool === "text" ? 180 : 160,
        height: tool === "text" ? 48 : 110,
        text: tool === "sticky" ? "New Note" : tool === "text" ? "Text Label" : "",
        color: tool === "sticky" ? "#FEF08A" : tool === "text" ? "#0F172A" : "#BFDBFE",
        points: [],
      };
      pushHistory([...elements, newEl]);
      setSelectedId(id);
      setTool("select");
      return;
    }

    if (tool === "connector") {
      const id = `el-${Date.now()}`;
      const newEl: BoardElement = {
        id,
        kind: "connector",
        x: world.x,
        y: world.y,
        x2: world.x + 120,
        y2: world.y,
        width: 120,
        height: 2,
        text: "",
        color: "#475569",
        points: [],
      };
      pushHistory([...elements, newEl]);
      dragRef.current = {
        mode: "connect",
        startX: world.x,
        startY: world.y,
        origX: world.x,
        origY: world.y,
        targetId: id,
      };
      setSelectedId(id);
      return;
    }

    if (tool === "draw") {
      const id = `el-${Date.now()}`;
      const newEl: BoardElement = {
        id,
        kind: "stroke",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        text: "",
        color: "#E11D48",
        points: [[world.x, world.y]],
      };
      pushHistory([...elements, newEl]);
      dragRef.current = {
        mode: "draw",
        startX: world.x,
        startY: world.y,
        origX: 0,
        origY: 0,
        targetId: id,
      };
      return;
    }

    setSelectedId(null);
  }

  function handleCanvasMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d.mode) return;
    if (d.mode === "pan") {
      setPan({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
      return;
    }
    const world = clientToWorld(e.clientX, e.clientY);
    if (d.mode === "move" && d.targetId) {
      const dx = world.x - d.startX;
      const dy = world.y - d.startY;
      setElements((prev) =>
        prev.map((el) =>
          el.id === d.targetId ? { ...el, x: d.origX + dx, y: d.origY + dy } : el,
        ),
      );
    } else if (d.mode === "connect" && d.targetId) {
      setElements((prev) =>
        prev.map((el) => (el.id === d.targetId ? { ...el, x2: world.x, y2: world.y } : el)),
      );
    } else if (d.mode === "draw" && d.targetId) {
      setElements((prev) =>
        prev.map((el) =>
          el.id === d.targetId ? { ...el, points: [...el.points, [world.x, world.y]] } : el,
        ),
      );
    }
  }

  function handleCanvasMouseUp() {
    dragRef.current.mode = null;
  }

  function handleExportSvg() {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board-${activeBoardId ?? "export"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedEl = elements.find((el) => el.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="boardforge"
        appName="BoardForge"
        accentClass="bg-rose-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("wb_token");
          setToken(null);
          setUser(null);
        }}
        rightSlot={
          <div className="flex items-center gap-2">
            <select
              value={activeBoardId ?? ""}
              onChange={(e) => selectBoard(Number(e.target.value))}
              aria-label="Select board"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <form onSubmit={handleCreateBoard} className="flex gap-1">
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="New board..."
                className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                aria-label="Create board"
                className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        }
      />

      {!activeBoardId ? (
        <div className="p-8">
          <EmptyState
            icon={<StickyNote className="h-6 w-6" />}
            title="Create your first whiteboard"
            description="Use the New board input in the top bar to start sketching."
          />
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            {[
              { id: "select", label: "Select", icon: MousePointer },
              { id: "pan", label: "Pan", icon: Hand },
              { id: "sticky", label: "Sticky Note", icon: StickyNote },
              { id: "text", label: "Text", icon: Type },
              { id: "rect", label: "Rectangle", icon: Square },
              { id: "circle", label: "Circle", icon: CircleIcon },
              { id: "connector", label: "Connector", icon: Minus },
              { id: "draw", label: "Draw", icon: PenTool },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  onClick={() => setTool(t.id as ToolKind)}
                  className={`rounded-lg p-2 text-xs transition ${
                    tool === t.id
                      ? "bg-rose-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
              title="Zoom In"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
              title="Zoom Out"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              type="button"
              onClick={handleSaveBoard}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={handleExportSvg}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              <Download className="h-3.5 w-3.5" /> SVG
            </button>
          </div>

          {savedBanner && (
            <div className="absolute right-4 top-4 z-20 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
              {savedBanner}
            </div>
          )}

          {/* Selection Inspector */}
          {selectedEl && (
            <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900/95">
              {selectedEl.kind !== "stroke" && selectedEl.kind !== "connector" && (
                <input
                  type="text"
                  value={selectedEl.text}
                  onChange={(e) =>
                    setElements((prev) =>
                      prev.map((el) =>
                        el.id === selectedEl.id ? { ...el, text: e.target.value } : el,
                      ),
                    )
                  }
                  placeholder="Element text..."
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              )}
              <div className="flex items-center gap-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      pushHistory(
                        elements.map((el) => (el.id === selectedEl.id ? { ...el, color: c } : el)),
                      )
                    }
                    className="h-5 w-5 rounded-full border border-slate-300"
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  pushHistory(elements.filter((el) => el.id !== selectedEl.id));
                  setSelectedId(null);
                }}
                aria-label="Delete element"
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Infinite Canvas */}
          <svg
            ref={svgRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="h-full w-full cursor-crosshair bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]"
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {elements.map((el) => {
                const isSelected = el.id === selectedId;
                const onSelectDown = (e: React.MouseEvent) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  setSelectedId(el.id);
                  const world = clientToWorld(e.clientX, e.clientY);
                  dragRef.current = {
                    mode: "move",
                    startX: world.x,
                    startY: world.y,
                    origX: el.x,
                    origY: el.y,
                    targetId: el.id,
                  };
                };

                if (el.kind === "stroke") {
                  const d = el.points
                    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`)
                    .join(" ");
                  return (
                    <path
                      key={el.id}
                      d={d}
                      fill="none"
                      stroke={el.color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      onMouseDown={onSelectDown}
                    />
                  );
                }

                if (el.kind === "connector") {
                  return (
                    <line
                      key={el.id}
                      x1={el.x}
                      y1={el.y}
                      x2={el.x2 ?? el.x + 100}
                      y2={el.y2 ?? el.y}
                      stroke={el.color}
                      strokeWidth={isSelected ? 4 : 2.5}
                      onMouseDown={onSelectDown}
                    />
                  );
                }

                if (el.kind === "circle") {
                  return (
                    <g key={el.id} onMouseDown={onSelectDown}>
                      <ellipse
                        cx={el.x + el.width / 2}
                        cy={el.y + el.height / 2}
                        rx={el.width / 2}
                        ry={el.height / 2}
                        fill={el.color}
                        stroke={isSelected ? "#E11D48" : "#64748B"}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                      <text
                        x={el.x + el.width / 2}
                        y={el.y + el.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-slate-900 text-xs font-medium select-none"
                      >
                        {el.text}
                      </text>
                    </g>
                  );
                }

                if (el.kind === "text") {
                  return (
                    <text
                      key={el.id}
                      x={el.x}
                      y={el.y + 20}
                      fill={el.color}
                      onMouseDown={onSelectDown}
                      className="text-base font-semibold select-none"
                    >
                      {el.text}
                    </text>
                  );
                }

                return (
                  <g key={el.id} onMouseDown={onSelectDown}>
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rx={el.kind === "sticky" ? 6 : 10}
                      fill={el.color}
                      stroke={isSelected ? "#E11D48" : "#94A3B8"}
                      strokeWidth={isSelected ? 2.5 : 1}
                    />
                    <text
                      x={el.x + 12}
                      y={el.y + 26}
                      className="fill-slate-900 text-xs font-medium select-none"
                    >
                      {el.text}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BoardForgeWorkspace />
    </ThemeProvider>
  );
}
