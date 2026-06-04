"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  LayoutTemplate,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  GeneratedAppDTO,
  deleteGeneratedApp,
  generateTemplateApp,
  toggleGeneratedAppSidebar,
} from "@/app/ai-template-builder/actions";
import { GeneratedAppIcon, GeneratedAppPreview } from "@/components/generated-app-preview";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function AiTemplateBuilderPage({
  initialApps,
  authError,
}: {
  initialApps: GeneratedAppDTO[];
  authError?: string;
}) {
  const [apps, setApps] = useState(initialApps);
  const [prompt, setPrompt] = useState("");
  const [selectedAppId, setSelectedAppId] = useState(initialApps[0]?.id ?? null);
  const [message, setMessage] = useState(authError ?? "");
  const [isGenerating, startGenerating] = useTransition();
  const [isPending, startTransition] = useTransition();
  const selectedApp = useMemo(
    () => apps.find((app) => app.id === selectedAppId) ?? apps[0] ?? null,
    [apps, selectedAppId]
  );

  function replaceApp(nextApp: GeneratedAppDTO) {
    setApps((current) => current.map((app) => (app.id === nextApp.id ? nextApp : app)));
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      setMessage("Enter an app idea prompt first.");
      return;
    }

    startGenerating(async () => {
      setMessage("");
      try {
        const app = await generateTemplateApp(prompt);
        setApps((current) => [app, ...current]);
        setSelectedAppId(app.id);
        setPrompt("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to generate app.");
      }
    });
  }

  function handleToggleSidebar(app: GeneratedAppDTO) {
    startTransition(async () => {
      setMessage("");
      try {
        const updated = await toggleGeneratedAppSidebar(app.id, !app.isSidebarPinned);
        replaceApp(updated);
        window.dispatchEvent(new Event("flowbase-sidebar-apps-updated"));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update sidebar.");
      }
    });
  }

  function handleDelete(app: GeneratedAppDTO) {
    if (!window.confirm(`Delete "${app.appName}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        await deleteGeneratedApp(app.id);
        window.dispatchEvent(new Event("flowbase-sidebar-apps-updated"));
        setApps((current) => {
          const next = current.filter((item) => item.id !== app.id);
          if (selectedAppId === app.id) {
            setSelectedAppId(next[0]?.id ?? null);
          }
          return next;
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete app.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-black text-[#d85749]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              AI Template Builder
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] lg:text-4xl">
              Turn a prompt into a cozy mini app.
            </h1>
            <p className="mt-3 text-base font-semibold leading-7 text-[#6b675f]">
              Describe a tracker, planner, or lightweight workflow. Flowbase saves the generated JSON for your account and renders it as a single-page template preview.
            </p>
          </div>
          <div className="rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 py-2 text-sm font-black text-[#403c37]">
            {apps.length} created
          </div>
        </div>

        <form onSubmit={handleGenerate} className="mt-6 grid gap-3">
          <label className="grid gap-2 text-sm font-black text-[#403c37]">
            App idea prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-32 resize-none rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 py-3 text-base font-semibold leading-7 outline-none transition placeholder:text-[#a9a196] focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
              placeholder="Build me a habit tracker with streaks, weekly progress, today's checklist, and quick add form..."
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#77736b]">
              Supports stats, lists, tables, forms, progress bars, checklists, tags, buttons, and chart placeholders.
            </p>
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#dc4d40] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>

        {message ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-[#f0c7c1] bg-[#fff0ed] px-4 py-3 text-sm font-bold text-[#944139]">
            <span className="min-w-0 flex-1">{message}</span>
            <button type="button" onClick={() => setMessage("")} className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-white" aria-label="Dismiss message">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.4fr]">
        <div className="rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#111827]">Created apps</h2>
              <p className="mt-1 text-sm font-semibold text-[#6b675f]">Only apps generated by your account appear here.</p>
            </div>
            <LayoutTemplate className="h-5 w-5 text-pink-600" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3">
            {apps.length ? (
              apps.map((app) => (
                <article
                  key={app.id}
                  className={cn(
                    "rounded-lg border bg-[#fffaf0] p-4 transition",
                    selectedApp?.id === app.id ? "border-[#f0c7c1] ring-2 ring-[#fee4df]" : "border-[#e1d8c8]"
                  )}
                >
                  <button type="button" onClick={() => setSelectedAppId(app.id)} className="flex w-full gap-3 text-left">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: app.color }}>
                      <GeneratedAppIcon icon={app.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black text-[#292524]">{app.appName}</span>
                      <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-[#6b675f]">{app.description}</span>
                    </span>
                  </button>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black text-[#77736b]">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#e1d8c8] bg-white px-2 py-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: app.color }} />
                      {app.color}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#e1d8c8] bg-white px-2 py-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDate(app.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Link
                      href={`/ai-template-builder/${app.id}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleSidebar(app)}
                      disabled={isPending}
                      className={cn(
                        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-black shadow-sm transition disabled:opacity-60",
                        app.isSidebarPinned
                          ? "border border-[#e1d8c8] bg-white text-[#944139] hover:border-[#f0c7c1]"
                          : "bg-[#ef594a] text-white hover:bg-[#dc4d40]"
                      )}
                    >
                      {app.isSidebarPinned ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                      {app.isSidebarPinned ? "Remove Sidebar" : "Add to Sidebar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(app)}
                      disabled={isPending}
                      className="grid h-10 w-full place-items-center rounded-md border border-[#f0c7c1] bg-[#fff0ed] text-[#944139] transition hover:bg-[#fee4df] disabled:opacity-60 sm:w-10"
                      aria-label={`Delete ${app.appName}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-5 py-10 text-center">
                <LayoutTemplate className="mx-auto h-8 w-8 text-pink-600" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-black text-[#292524]">No generated apps yet</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                  Try a prompt like “meal planner with grocery list and weekly macros.”
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {selectedApp ? (
            <GeneratedAppPreview app={selectedApp} />
          ) : (
            <div className="grid min-h-[520px] place-items-center rounded-lg border border-dashed border-[#d8cdbb] bg-[#fffaf0] p-6 text-center">
              <div className="max-w-[380px]">
                <Sparkles className="mx-auto h-10 w-10 text-[#ef594a]" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-black text-[#292524]">Generated app preview</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#6b675f]">
                  Your newest generated app appears here after it is saved.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
