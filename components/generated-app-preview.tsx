"use client";

import {
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  LayoutTemplate,
  ListChecks,
  NotebookPen,
  PiggyBank,
  Sparkles,
  Target,
  Utensils,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  GeneratedAppDTO,
  GeneratedAppComponent,
  updateGeneratedAppSchema,
} from "@/app/ai-template-builder/actions";
import type { GeneratedAppSchema } from "@/db/schema";
import { cn } from "@/lib/utils";

const iconMap = {
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  LayoutTemplate,
  ListChecks,
  NotebookPen,
  PiggyBank,
  Sparkles,
  Target,
  Utensils,
  WalletCards,
};

function valueText(value: unknown, fallback = "") {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function itemLabel(item: Record<string, unknown>, fallback: string) {
  return valueText(item.label ?? item.name ?? item.title, fallback);
}

function itemValue(item: Record<string, unknown>, fallback = "") {
  return valueText(item.value ?? item.amount ?? item.status ?? item.detail, fallback);
}

function itemMinutes(item: Record<string, unknown>) {
  const direct = Number(item.minutes ?? item.duration ?? item.time ?? item.value);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const text = Object.values(item).map((value) => valueText(value)).join(" ");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|h|hr|hour|hours)?/i);
  return match ? Number(match[1]) : 0;
}

function clampProgress(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 50;
}

function evaluateCalculatorExpression(expression: string) {
  const normalized = expression.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

  if (!/^[0-9+\-*/().\s]+$/.test(normalized)) {
    throw new Error("Invalid expression");
  }

  const result = Function(`"use strict"; return (${normalized});`)() as unknown;

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Invalid result");
  }

  return Number(result.toFixed(10)).toString();
}

function ComponentShell({ component, children }: { component: GeneratedAppComponent; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e1d8c8] bg-white p-4 shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
      <div className="mb-4">
        <h3 className="text-base font-black text-[#292524]">{component.title || "Untitled block"}</h3>
        {component.description ? (
          <p className="mt-1 text-sm font-medium leading-6 text-[#6b675f]">{component.description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type ComponentUpdate = (componentId: string, updater: (component: GeneratedAppComponent) => GeneratedAppComponent) => void;

function StatsBlock({
  component,
  derivedStats,
}: {
  component: GeneratedAppComponent;
  derivedStats: Record<string, string>;
}) {
  const items = component.items?.length ? component.items : [{ label: "Progress", value: "68%" }];

  return (
    <ComponentShell component={component}>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.slice(0, 4).map((item, index) => (
          <div key={`${component.id}-stat-${index}`} className="rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-3">
            <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-[#8a867d]">
              {itemLabel(item, `Metric ${index + 1}`)}
            </p>
            <p className="mt-2 truncate text-2xl font-black text-[#111827]">
              {derivedStats[itemLabel(item, `Metric ${index + 1}`).toLowerCase()] ?? itemValue(item, "12")}
            </p>
          </div>
        ))}
      </div>
    </ComponentShell>
  );
}

function ListBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const items = component.items?.length ? component.items : [{ label: "Add your first item", value: "Today" }];

  return (
    <ComponentShell component={component}>
      <div className="space-y-2">
        {items.slice(0, 6).map((item, index) => (
          <div key={`${component.id}-list-${index}`} className="flex items-center gap-3 rounded-md border border-[#e8dfcf] bg-[#fffaf0] px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" style={{ color: valueText(item.color, "#ef594a") }} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#292524]">{itemLabel(item, `Item ${index + 1}`)}</span>
            <span className="truncate text-xs font-bold text-[#77736b]">{itemValue(item)}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onUpdate(component.id, (current) => ({
            ...current,
            items: [
              ...(current.items ?? []),
              { label: `New item ${(current.items?.length ?? 0) + 1}`, value: "Active" },
            ],
          }))
        }
        className="mt-3 h-9 rounded-md border border-[#e1d8c8] bg-white px-3 text-xs font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
      >
        Add item
      </button>
    </ComponentShell>
  );
}

function TableBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const items = component.items?.length ? component.items : [{ name: "Sample row", status: "Ready", value: "42" }];
  const columns = Array.from(
    new Set(items.flatMap((item) => Object.keys(item)).filter((key) => key !== "color" && key !== "checked"))
  ).slice(0, 4);

  return (
    <ComponentShell component={component}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e8dfcf] text-xs font-black uppercase tracking-[0.08em] text-[#8a867d]">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 capitalize">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 6).map((item, rowIndex) => (
              <tr key={`${component.id}-row-${rowIndex}`} className="border-b border-[#f2eadf] last:border-0">
                {columns.map((column) => (
                  <td key={column} className="max-w-[180px] truncate px-3 py-3 font-semibold text-[#403c37]">
                    {valueText(item[column], "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() =>
          onUpdate(component.id, (current) => {
            const currentItems = current.items ?? [];
            const keys = Object.keys(currentItems[0] ?? { name: "", status: "", value: "" }).slice(0, 4);
            const nextRow = Object.fromEntries(keys.map((key) => [key, key === "status" ? "New" : `Entry ${currentItems.length + 1}`]));
            return { ...current, items: [...currentItems, nextRow] };
          })
        }
        className="mt-3 h-9 rounded-md border border-[#e1d8c8] bg-white px-3 text-xs font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
      >
        Add row
      </button>
    </ComponentShell>
  );
}

function FormBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const fields = component.fields?.length ? component.fields : [{ label: "Name", type: "text", placeholder: "New entry" }];
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftValues({});
  }, [component.id]);

  return (
    <ComponentShell component={component}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.slice(0, 6).map((field, index) => (
          <label key={`${component.id}-field-${index}`} className="grid gap-1.5 text-sm font-bold text-[#403c37]">
            {field.label}
            {field.type === "textarea" ? (
              <textarea
                value={draftValues[field.label] ?? ""}
                onChange={(event) => setDraftValues((current) => ({ ...current, [field.label]: event.target.value }))}
                placeholder={field.placeholder ?? ""}
                className="min-h-20 resize-none rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 py-2 text-sm outline-none"
              />
            ) : (
              <input
                type={field.type === "number" || field.type === "date" ? field.type : "text"}
                value={draftValues[field.label] ?? ""}
                onChange={(event) => setDraftValues((current) => ({ ...current, [field.label]: event.target.value }))}
                placeholder={field.placeholder ?? ""}
                className="h-10 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm outline-none"
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onUpdate(component.id, (current) => {
            const currentFields = current.fields ?? [];
            const entry = Object.fromEntries(
              currentFields.map((field) => [field.label, draftValues[field.label]?.trim() || field.placeholder || "New entry"])
            );
            setDraftValues({});
            return {
              ...current,
              items: [...(current.items ?? []), entry],
              fields: currentFields,
            };
          })
        }
        className="mt-4 h-10 rounded-md bg-[#ef594a] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#dc4d40]"
      >
        Save entry
      </button>
      {component.items?.length ? (
        <div className="mt-4 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8a867d]">Saved entries</p>
          <div className="mt-2 space-y-2">
            {component.items.slice(-3).map((item, index) => (
              <p key={`${component.id}-entry-${index}`} className="truncate text-sm font-bold text-[#403c37]">
                {Object.values(item).map((value) => valueText(value)).filter(Boolean).join(" - ") || "New entry"}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </ComponentShell>
  );
}

function ProgressBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const items = component.items?.length ? component.items : [{ label: "Weekly progress", progress: 64 }];

  return (
    <ComponentShell component={component}>
      <div className="space-y-4">
        {items.slice(0, 5).map((item, index) => {
          const progress = clampProgress(item.progress ?? item.value);
          return (
            <div key={`${component.id}-progress-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
                <span className="truncate text-[#403c37]">{itemLabel(item, `Progress ${index + 1}`)}</span>
                <span className="text-[#77736b]">{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#f1eadf]">
                <div className="h-full rounded-full bg-[#ef594a]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex gap-2">
                {[-10, 10].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() =>
                      onUpdate(component.id, (current) => ({
                        ...current,
                        items: (current.items ?? items).map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, progress: Math.max(0, Math.min(100, progress + delta)), value: `${Math.max(0, Math.min(100, progress + delta))}%` }
                            : entry
                        ),
                      }))
                    }
                    className="h-8 rounded-md border border-[#e1d8c8] bg-white px-2 text-xs font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
                  >
                    {delta > 0 ? "+10" : "-10"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ComponentShell>
  );
}

function ChecklistBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const items = component.items?.length ? component.items : [{ label: "First step", checked: true }];
  const [newItem, setNewItem] = useState("");

  return (
    <ComponentShell component={component}>
      <div className="space-y-2">
        {items.slice(0, 12).map((item, index) => (
          <div
            key={`${component.id}-check-${index}`}
            className="flex flex-col gap-2 rounded-md bg-[#fffaf0] px-3 py-2 sm:flex-row sm:items-center"
          >
            <button
              type="button"
              onClick={() =>
                onUpdate(component.id, (current) => ({
                  ...current,
                  items: (current.items ?? items).map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, checked: !Boolean(entry.checked) } : entry
                  ),
                }))
              }
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded border",
                item.checked ? "border-[#55cdb4] bg-[#55cdb4] text-white" : "border-[#d8cdbb] bg-white text-transparent"
              )}
              aria-label={item.checked ? "Mark incomplete" : "Mark complete"}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <input
              value={itemLabel(item, `Step ${index + 1}`)}
              onChange={(event) =>
                onUpdate(component.id, (current) => ({
                  ...current,
                  items: (current.items ?? items).map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, label: event.target.value } : entry
                  ),
                }))
              }
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-[#292524] outline-none transition focus:border-[#e1d8c8] focus:bg-white"
              aria-label={`Edit checklist item ${index + 1}`}
            />
            <button
              type="button"
              onClick={() =>
                onUpdate(component.id, (current) => ({
                  ...current,
                  items: (current.items ?? items).filter((_, entryIndex) => entryIndex !== index),
                }))
              }
              className="h-8 rounded-md border border-[#f0c7c1] bg-white px-2 text-xs font-black text-[#944139] transition hover:bg-[#fff0ed]"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const label = newItem.trim();
          if (!label) {
            return;
          }
          onUpdate(component.id, (current) => ({
            ...current,
            items: [...(current.items ?? []), { label, checked: false }],
          }));
          setNewItem("");
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add a new item"
          className="h-10 min-w-0 flex-1 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-[#ef594a] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#dc4d40]"
        >
          Add item
        </button>
      </form>
    </ComponentShell>
  );
}

function ButtonsBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const actions = component.actions?.length ? component.actions : [{ label: "Add item", variant: "primary" as const }];

  return (
    <ComponentShell component={component}>
      <div className="flex flex-wrap gap-2">
        {actions.slice(0, 5).map((action, index) => (
          <button
            key={`${component.id}-button-${index}`}
            type="button"
            onClick={() =>
              onUpdate(component.id, (current) => ({
                ...current,
                items: [
                  ...(current.items ?? []),
                  { label: `${action.label} clicked`, value: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
                ],
              }))
            }
            className={cn(
              "h-10 rounded-md px-4 text-sm font-black shadow-sm",
              action.variant === "primary"
                ? "bg-[#ef594a] text-white"
                : "border border-[#e1d8c8] bg-white text-[#403c37]"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
      {component.items?.length ? (
        <p className="mt-3 rounded-md bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#6b675f]">
          Last action: {itemLabel(component.items[component.items.length - 1], "Action")} {itemValue(component.items[component.items.length - 1])}
        </p>
      ) : null}
    </ComponentShell>
  );
}

function CalculatorBlock({ component, onUpdate }: { component: GeneratedAppComponent; onUpdate: ComponentUpdate }) {
  const [display, setDisplay] = useState("0");
  const [error, setError] = useState("");
  const history = component.items ?? [];
  const keys = [
    "C",
    "Del",
    "%",
    "/",
    "7",
    "8",
    "9",
    "*",
    "4",
    "5",
    "6",
    "-",
    "1",
    "2",
    "3",
    "+",
    "0",
    ".",
    "=",
  ];

  function appendKey(key: string) {
    setError("");

    if (key === "C") {
      setDisplay("0");
      return;
    }

    if (key === "Del") {
      setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
      return;
    }

    if (key === "=") {
      try {
        const expression = display;
        const result = evaluateCalculatorExpression(expression);
        setDisplay(result);
        onUpdate(component.id, (current) => ({
          ...current,
          items: [{ label: expression, value: result }, ...(current.items ?? [])].slice(0, 8),
        }));
      } catch {
        setError("Check the expression.");
      }
      return;
    }

    setDisplay((current) => (current === "0" && /[0-9.]/.test(key) ? key : `${current}${key}`));
  }

  return (
    <ComponentShell component={component}>
      <div className="mx-auto max-w-md rounded-lg border border-[#e1d8c8] bg-[#fffaf0] p-3">
        <div className="min-h-20 rounded-md border border-[#e8dfcf] bg-white px-4 py-3 text-right">
          <p className="break-all text-3xl font-black tracking-tight text-[#111827]">{display}</p>
          <p className="mt-1 min-h-5 text-xs font-bold text-[#944139]">{error}</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => appendKey(key)}
              className={cn(
                "h-12 rounded-md border border-[#e1d8c8] bg-white text-base font-black text-[#292524] shadow-sm transition hover:border-[#ef594a] hover:text-[#ef594a]",
                key === "=" && "col-span-2 bg-[#ef594a] text-white hover:bg-[#dc4d40] hover:text-white",
                ["+", "-", "*", "/", "%"].includes(key) && "bg-[#eefbf7] text-[#386f61]",
                ["C", "Del"].includes(key) && "bg-[#fff0ed] text-[#944139]"
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      {history.length ? (
        <div className="mt-4 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8a867d]">History</p>
          <div className="mt-2 space-y-2">
            {history.slice(0, 5).map((item, index) => (
              <button
                key={`${component.id}-history-${index}`}
                type="button"
                onClick={() => setDisplay(itemValue(item, "0"))}
                className="flex w-full items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-left text-sm font-bold text-[#403c37] transition hover:text-[#ef594a]"
              >
                <span className="min-w-0 truncate">{itemLabel(item, "Calculation")}</span>
                <span className="shrink-0">{itemValue(item)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </ComponentShell>
  );
}

function TagsBlock({ component }: { component: GeneratedAppComponent }) {
  const items = component.items?.length ? component.items : [{ label: "Ready" }, { label: "Focus" }];

  return (
    <ComponentShell component={component}>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 12).map((item, index) => (
          <span
            key={`${component.id}-tag-${index}`}
            className="rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 py-1.5 text-xs font-black text-[#403c37]"
          >
            {itemLabel(item, `Tag ${index + 1}`)}
          </span>
        ))}
      </div>
    </ComponentShell>
  );
}

function ChartBlock({ component }: { component: GeneratedAppComponent }) {
  const items = component.items?.length ? component.items : [{ label: "Mon", value: 40 }, { label: "Tue", value: 70 }];
  const values = items.map((item) => Number(item.value ?? item.progress ?? 40)).filter(Number.isFinite);
  const max = Math.max(1, ...values);

  return (
    <ComponentShell component={component}>
      <div className="flex h-44 items-end gap-3 rounded-md border border-[#e8dfcf] bg-[#fffaf0] px-4 py-3">
        {items.slice(0, 8).map((item, index) => {
          const height = Math.max(12, (Number(item.value ?? item.progress ?? 40) / max) * 100);
          return (
            <div key={`${component.id}-chart-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-md bg-[#55cdb4]" style={{ height: `${height}%` }} />
              <span className="w-full truncate text-center text-[11px] font-bold text-[#77736b]">{itemLabel(item, `${index + 1}`)}</span>
            </div>
          );
        })}
      </div>
    </ComponentShell>
  );
}

function UnknownBlock({ component }: { component: GeneratedAppComponent }) {
  return (
    <ComponentShell component={component}>
      <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] p-4 text-sm font-bold text-[#6b675f]">
        This generated block is not supported yet.
      </div>
    </ComponentShell>
  );
}

function RenderComponent({
  component,
  onUpdate,
  derivedStats,
}: {
  component: GeneratedAppComponent;
  onUpdate: ComponentUpdate;
  derivedStats: Record<string, string>;
}) {
  if (component.type === "stats") return <StatsBlock component={component} derivedStats={derivedStats} />;
  if (component.type === "list") return <ListBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "table") return <TableBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "form") return <FormBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "progress") return <ProgressBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "checklist") return <ChecklistBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "buttons") return <ButtonsBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "calculator") return <CalculatorBlock component={component} onUpdate={onUpdate} />;
  if (component.type === "tags") return <TagsBlock component={component} />;
  if (component.type === "chart") return <ChartBlock component={component} />;
  return <UnknownBlock component={component} />;
}

export function GeneratedAppIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon as keyof typeof iconMap] ?? LayoutTemplate;
  return <Icon className={className} aria-hidden="true" />;
}

type SaveStatus = "Saved" | "Saving..." | "Unsaved" | "Save failed";

export function GeneratedAppPreview({ app, compact = false }: { app: GeneratedAppDTO; compact?: boolean }) {
  const [schema, setSchema] = useState(app.schema);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const hydratedApp = useMemo<GeneratedAppDTO>(
    () => ({
      ...app,
      appName: schema.appName,
      description: schema.description,
      icon: schema.icon,
      color: schema.color,
      layout: schema.layout,
      schema,
    }),
    [app, schema]
  );
  const derivedStats = useMemo(() => {
    const checklistItems = schema.sections.flatMap((section) =>
      section.components
        .filter((component) => component.type === "checklist")
        .flatMap((component) => component.items ?? [])
    );
    const total = checklistItems.length;
    const completedItems = checklistItems.filter((item) => Boolean(item.checked));
    const completed = completedItems.length;
    const remaining = Math.max(0, total - completed);
    const totalMinutes = checklistItems.reduce((sum, item) => sum + itemMinutes(item), 0);
    const completedMinutes = completedItems.reduce((sum, item) => sum + itemMinutes(item), 0);
    const percent = total ? Math.round((completed / total) * 100) : 0;

    return {
      completed: String(completed),
      done: String(completed),
      remaining: String(remaining),
      total: String(total),
      tasks: String(total),
      "tasks done": String(completed),
      "task completion": `${percent}%`,
      progress: `${percent}%`,
      percent: `${percent}%`,
      "completion rate": `${percent}%`,
      minutes: String(totalMinutes),
      "minutes done": String(completedMinutes),
      "study minutes": String(totalMinutes),
    };
  }, [schema]);

  useEffect(() => {
    setSchema(app.schema);
    setSaveStatus("Saved");
    setMessage("");
  }, [app.id, app.schema]);

  useEffect(() => {
    if (saveStatus !== "Unsaved") {
      return;
    }

    const handle = window.setTimeout(() => {
      const nextSchema = schema;
      setSaveStatus("Saving...");
      startTransition(async () => {
        try {
          const updated = await updateGeneratedAppSchema(app.id, nextSchema);
          setSchema(updated.schema);
          setSaveStatus("Saved");
          setMessage("");
        } catch (error) {
          setSaveStatus("Save failed");
          setMessage(error instanceof Error ? error.message : "Unable to save generated app.");
        }
      });
    }, 1400);

    return () => window.clearTimeout(handle);
  }, [app.id, saveStatus, schema]);

  function updateComponent(componentId: string, updater: (component: GeneratedAppComponent) => GeneratedAppComponent) {
    setSchema((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        components: section.components.map((component) => (component.id === componentId ? updater(component) : component)),
      })),
    }));
    setSaveStatus("Unsaved");
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-[#e1d8c8] bg-[#fffaf0] shadow-sm", compact ? "p-4" : "p-5 sm:p-6")}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8dfcf] pb-5">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-white shadow-sm" style={{ backgroundColor: hydratedApp.color }}>
            <GeneratedAppIcon icon={hydratedApp.icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d85749]">Generated template</p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-[#111827]">{hydratedApp.appName}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#6b675f]">{hydratedApp.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-[#e1d8c8] bg-white px-3 py-2 text-xs font-black text-[#403c37]">
            {hydratedApp.layout}
          </div>
          <div
            className={cn(
              "rounded-md border border-[#e1d8c8] bg-white px-3 py-2 text-xs font-black text-[#6b675f]",
              saveStatus === "Save failed" && "border-[#f0c7c1] bg-[#fff0ed] text-[#944139]",
              saveStatus === "Saving..." && "border-[#c9eadf] bg-[#eefbf7] text-[#386f61]"
            )}
          >
            {isPending ? "Saving..." : saveStatus}
          </div>
        </div>
      </header>
      {message ? (
        <div className="mt-4 rounded-md border border-[#f0c7c1] bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#944139]">
          {message}
        </div>
      ) : null}

      <div className={cn("space-y-5", compact ? "mt-4" : "mt-6")}>
        {hydratedApp.schema.sections.map((section) => (
          <section key={section.id} className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-[#111827]">{section.title}</h3>
              {section.description ? <p className="mt-1 text-sm font-semibold text-[#6b675f]">{section.description}</p> : null}
            </div>
            <div className="grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
              {section.components.map((component) => (
                <RenderComponent
                  key={component.id}
                  component={component}
                  onUpdate={updateComponent}
                  derivedStats={derivedStats}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
