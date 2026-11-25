import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8007";

type LayoutType = "vertical_scroll" | "horizontal_slides" | "editorial_grid";
type CardType = "heading" | "paragraph" | "image" | "link" | "callout";

interface StoryCard {
  id: number;
  card_type: CardType;
  title: string;
  body: string;
  media_url: string;
  position: number;
}

interface StoryItem {
  id: number;
  title: string;
  subtitle: string;
  layout: LayoutType;
  is_published: boolean;
  public_slug: string;
  cards: StoryCard[];
}

function StoryRenderer({
  title,
  subtitle,
  layout,
  cards,
}: {
  title: string;
  subtitle: string;
  layout: LayoutType;
  cards: StoryCard[];
}) {
  const containerClass =
    layout === "horizontal_slides"
      ? "flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4"
      : layout === "editorial_grid"
        ? "grid grid-cols-1 gap-5 md:grid-cols-2"
        : "space-y-5";

  return (
    <article className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 p-8 text-white shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-teal-50">{subtitle}</p>}
      </div>

      <div className={containerClass}>
        {cards.map((c) => {
          const slideCls =
            layout === "horizontal_slides" ? "w-80 sm:w-96 shrink-0 snap-center" : "";
          return (
            <div
              key={c.id}
              className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${slideCls}`}
            >
              {c.card_type === "heading" && (
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{c.title}</h2>
              )}
              {c.card_type === "paragraph" && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {c.body}
                </p>
              )}
              {c.card_type === "callout" && (
                <blockquote className="border-l-4 border-teal-600 pl-4 italic text-slate-700 dark:text-slate-300">
                  {c.body}
                </blockquote>
              )}
              {c.card_type === "image" && (
                <figure>
                  <img
                    src={c.media_url}
                    alt={c.title || "Story visual"}
                    className="max-h-72 w-full rounded-xl object-cover"
                  />
                  {c.title && (
                    <figcaption className="mt-2 text-xs text-slate-500">{c.title}</figcaption>
                  )}
                </figure>
              )}
              {c.card_type === "link" && (
                <a
                  href={c.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-teal-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {c.title || c.media_url}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function PublicStoryView({ slug }: { slug: string }) {
  const [story, setStory] = useState<StoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/stories/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Published story not found."))))
      .then(setStory)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-rose-600">
        {error}
      </div>
    );
  }
  if (!story) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-slate-500">
        Loading story...
      </div>
    );
  }
  return (
    <div>
      <div className="no-print mx-auto flex max-w-4xl justify-end px-4 pt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
        >
          <Printer className="h-3.5 w-3.5" /> Print / Save PDF
        </button>
      </div>
      <StoryRenderer
        title={story.title}
        subtitle={story.subtitle}
        layout={story.layout}
        cards={story.cards}
      />
    </div>
  );
}

function StoryForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("sf_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const [newTitle, setNewTitle] = useState("");
  const [cardType, setCardType] = useState<CardType>("heading");
  const [cardTitle, setCardTitle] = useState("");
  const [cardBody, setCardBody] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const publicSlug = new URLSearchParams(window.location.search).get("story");

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadStories = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/stories`, { headers: authHeaders() });
    if (res.ok) {
      const data: StoryItem[] = await res.json();
      setStories(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadStories();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadStories]);

  if (publicSlug) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <AppHeader
          currentAppId="storyforge"
          appName="StoryForge"
          accentClass="bg-teal-600"
          user={null}
        />
        <PublicStoryView slug={publicSlug} />
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="storyforge"
          appName="StoryForge"
          accentClass="bg-teal-600"
          user={null}
        />
        <AuthScreen
          appName="StoryForge"
          tagline="Create interactive stories, visual reports, and responsive presentations"
          accentClass="bg-teal-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("sf_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  const activeStory = stories.find((s) => s.id === selectedId) ?? null;

  async function handleCreateStory(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch(`${API_BASE}/api/stories`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: newTitle.trim(), subtitle: "" }),
    });
    if (res.ok) {
      const created: StoryItem = await res.json();
      setNewTitle("");
      await loadStories();
      setSelectedId(created.id);
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStory) return;
    const res = await fetch(`${API_BASE}/api/stories/${activeStory.id}/cards`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        card_type: cardType,
        title: cardTitle,
        body: cardBody,
        media_url: cardUrl,
      }),
    });
    if (res.ok) {
      setCardTitle("");
      setCardBody("");
      setCardUrl("");
      await loadStories();
    }
  }

  async function handleMoveCard(index: number, dir: -1 | 1) {
    if (!activeStory) return;
    const ids = activeStory.cards.map((c) => c.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch(`${API_BASE}/api/stories/${activeStory.id}/cards/reorder`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ card_ids: ids }),
    });
    await loadStories();
  }

  async function handleDeleteCard(cardId: number) {
    if (!activeStory) return;
    await fetch(`${API_BASE}/api/stories/${activeStory.id}/cards/${cardId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await loadStories();
  }

  async function handleUpdateStory(patch: Record<string, unknown>) {
    if (!activeStory) return;
    await fetch(`${API_BASE}/api/stories/${activeStory.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    await loadStories();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="storyforge"
        appName="StoryForge"
        accentClass="bg-teal-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("sf_token");
          setToken(null);
          setUser(null);
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        <aside className="no-print lg:col-span-3 space-y-4">
          <form onSubmit={handleCreateStory} className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New story title..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              aria-label="Create story"
              className="rounded-lg bg-teal-600 px-3 py-2 text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          <div className="space-y-1.5">
            {stories.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  s.id === activeStory?.id
                    ? "border-teal-500 bg-teal-50/70 font-semibold text-teal-950 dark:bg-teal-950/40 dark:text-teal-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="truncate">{s.title}</span>
                <Badge variant={s.is_published ? "success" : "neutral"}>
                  {s.is_published ? "Live" : "Draft"}
                </Badge>
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-9 space-y-5">
          {!activeStory ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="No story selected"
              description="Create a story, report, or presentation from the sidebar."
            />
          ) : (
            <>
              <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activeStory.layout}
                    onChange={(e) => handleUpdateStory({ layout: e.target.value })}
                    aria-label="Story layout"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="vertical_scroll">Vertical Scroll</option>
                    <option value="horizontal_slides">Horizontal Slides</option>
                    <option value="editorial_grid">Editorial Grid</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {mode === "edit" ? "Preview" : "Back to Editor"}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                  >
                    <Printer className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStory({ is_published: !activeStory.is_published })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                      activeStory.is_published ? "bg-emerald-600" : "bg-teal-600"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {activeStory.is_published ? "Published" : "Publish"}
                  </button>
                  {activeStory.is_published && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `${window.location.origin}/?story=${activeStory.public_slug}`,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Share Link"}
                    </button>
                  )}
                </div>
              </div>

              {mode === "preview" ? (
                <StoryRenderer
                  title={activeStory.title}
                  subtitle={activeStory.subtitle}
                  layout={activeStory.layout}
                  cards={activeStory.cards}
                />
              ) : (
                <div className="space-y-4">
                  {activeStory.cards.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div>
                        <Badge variant="info">{c.card_type}</Badge>
                        {c.title && <div className="mt-1 font-semibold">{c.title}</div>}
                        {c.body && <p className="mt-1 text-xs text-slate-500">{c.body}</p>}
                        {c.media_url && (
                          <div className="mt-1 text-xs text-teal-600">{c.media_url}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Move card up"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, 1)}
                          disabled={idx === activeStory.cards.length - 1}
                          aria-label="Move card down"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(c.id)}
                          aria-label="Delete card"
                          className="rounded p-1 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <form
                    onSubmit={handleAddCard}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3"
                  >
                    <h3 className="text-sm font-bold">Add Content Card</h3>
                    <select
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value as CardType)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="heading">Heading</option>
                      <option value="paragraph">Paragraph</option>
                      <option value="callout">Callout / Quote</option>
                      <option value="image">Image</option>
                      <option value="link">Link</option>
                    </select>
                    {(cardType === "heading" || cardType === "image" || cardType === "link") && (
                      <input
                        type="text"
                        value={cardTitle}
                        onChange={(e) => setCardTitle(e.target.value)}
                        placeholder={
                          cardType === "heading"
                            ? "Section heading..."
                            : cardType === "image"
                              ? "Image caption..."
                              : "Link label..."
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}
                    {(cardType === "paragraph" || cardType === "callout") && (
                      <textarea
                        rows={3}
                        value={cardBody}
                        onChange={(e) => setCardBody(e.target.value)}
                        placeholder="Write your content..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}
                    {(cardType === "image" || cardType === "link") && (
                      <input
                        type="url"
                        required
                        value={cardUrl}
                        onChange={(e) => setCardUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}
                    <button
                      type="submit"
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      Add Card
                    </button>
                  </form>
                </div>
              )}
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
      <StoryForgeWorkspace />
    </ThemeProvider>
  );
}
