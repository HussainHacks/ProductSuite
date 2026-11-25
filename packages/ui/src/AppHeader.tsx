import React, { useState } from "react";
import { Grid, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export interface SuiteAppInfo {
  id: string;
  name: string;
  tagline: string;
  port: number;
  accentClass: string;
}

export const SUITE_APPS: SuiteAppInfo[] = [
  { id: "formforge", name: "FormForge", tagline: "Forms & Surveys", port: 5171, accentClass: "bg-indigo-600" },
  { id: "taskforge", name: "TaskForge", tagline: "Personal Tasks", port: 5172, accentClass: "bg-sky-600" },
  { id: "planforge", name: "PlanForge", tagline: "Project Boards", port: 5173, accentClass: "bg-emerald-600" },
  { id: "bookforge", name: "BookForge", tagline: "Bookings", port: 5174, accentClass: "bg-violet-600" },
  { id: "dataforge", name: "DataForge", tagline: "Custom Lists", port: 5175, accentClass: "bg-amber-600" },
  { id: "boardforge", name: "BoardForge", tagline: "Whiteboard", port: 5176, accentClass: "bg-rose-600" },
  { id: "storyforge", name: "StoryForge", tagline: "Interactive Stories", port: 5177, accentClass: "bg-teal-600" },
];

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  organization_id: number;
  organization_name: string;
}

interface AppHeaderProps {
  currentAppId: string;
  appName: string;
  accentClass: string;
  user: AuthUser | null;
  onLogout?: () => void;
  rightSlot?: React.ReactNode;
}

export function AppHeader({
  currentAppId,
  appName,
  accentClass,
  user,
  onLogout,
  rightSlot,
}: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-label="Switch ProductSuite application"
              aria-expanded={switcherOpen}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Grid className="h-5 w-5" />
            </button>
            {switcherOpen && (
              <div
                role="menu"
                className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  ProductSuite Ecosystem
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {SUITE_APPS.map((app) => (
                    <a
                      key={app.id}
                      href={`http://localhost:${app.port}`}
                      onClick={() => setSwitcherOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                        app.id === currentAppId
                          ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${app.accentClass}`} />
                      <div className="flex flex-col">
                        <span>{app.name}</span>
                        <span className="text-xs text-slate-400">{app.tagline}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${accentClass}`}>
              {appName.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              {appName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {rightSlot}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium text-slate-900 dark:text-white">
                  {user.full_name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {user.organization_name}
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
