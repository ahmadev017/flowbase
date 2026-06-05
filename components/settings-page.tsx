"use client";

import { PricingTable, useClerk } from "@clerk/nextjs";
import {
  AlarmClock,
  Bell,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  FileText,
  Flag,
  Heart,
  KeyRound,
  Lightbulb,
  Map,
  MessageCircle,
  Moon,
  NotebookPen,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Repeat2,
  Save,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Target,
  Trash2,
  UserRound,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  createUserCategory,
  deleteUserCategory,
  exportUserData,
  updateUserCategory,
  updateUserSettings,
  type CategoryInput,
  type CategoryScope,
  type SettingsPageDTO,
  type UserCategoryDTO,
  type UserSettingsDTO,
} from "@/app/settings/actions";
import { cn } from "@/lib/utils";

const iconMap = {
  AlarmClock,
  BookOpen,
  BriefcaseBusiness,
  Bug,
  CalendarDays,
  CheckCircle2,
  FileText,
  Flag,
  Heart,
  Lightbulb,
  Map,
  MessageCircle,
  NotebookPen,
  Repeat2,
  Sparkles,
  Tag,
  Target,
  Users,
  Zap,
};

const iconOptions = Object.keys(iconMap);
const colorOptions = ["#ef594a", "#55cdb4", "#f4b333", "#8b5cf6", "#2d9cdb", "#dc6259", "#168f79", "#df8a2f"];

const scopeMeta: Record<CategoryScope, { label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string }> = {
  calendar: { label: "Calendar events", icon: CalendarDays, color: "text-teal-600" },
  kanban: { label: "Tasks / Kanban", icon: CheckCircle2, color: "text-amber-600" },
  notes: { label: "Notes", icon: FileText, color: "text-sky-600" },
  reminders: { label: "Reminders", icon: AlarmClock, color: "text-rose-600" },
};

const sections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "ai", label: "AI settings", icon: Bot },
  { id: "preferences", label: "Preferences", icon: Settings },
  { id: "security", label: "Privacy", icon: Shield },
] as const;

type SectionId = (typeof sections)[number]["id"];
const clerkBillingEnabled = process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED === "true";

function Card({
  icon: Icon,
  title,
  description,
  children,
  action,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-[0_1px_2px_rgba(44,38,31,0.08)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#fff1df] text-[#d85749]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#171717]">{title}</h2>
            {description ? <p className="mt-1 text-sm font-semibold leading-6 text-[#6b675f]">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-bold text-[#403c37]">{children}</span>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm font-bold text-[#403c37] outline-none transition focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex min-w-0 items-center justify-between gap-4 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#292524]">{label}</span>
        {description ? <span className="mt-1 block text-xs font-semibold leading-5 text-[#6b675f]">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#ef594a]"
      />
    </label>
  );
}

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon as keyof typeof iconMap] ?? Tag;
  return <Icon className={className} aria-hidden="true" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#d8cdbb] bg-[#fffaf0] px-4 py-7 text-center text-sm font-bold text-[#6b675f]">
      {message}
    </div>
  );
}

export function SettingsPage({
  initialData,
  authError,
}: {
  initialData: SettingsPageDTO | null;
  authError?: string;
}) {
  const clerk = useClerk();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [settings, setSettings] = useState<UserSettingsDTO | null>(initialData?.settings ?? null);
  const [categories, setCategories] = useState<UserCategoryDTO[]>(initialData?.categories ?? []);
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("calendar");
  const [categoryForm, setCategoryForm] = useState<CategoryInput>({
    scope: "calendar",
    name: "",
    color: "#ef594a",
    icon: "Tag",
  });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [message, setMessage] = useState(authError ?? "");
  const [showPricing, setShowPricing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const groupedCategories = useMemo(
    () =>
      categories.reduce<Record<CategoryScope, UserCategoryDTO[]>>(
        (groups, category) => {
          groups[category.scope].push(category);
          return groups;
        },
        { calendar: [], kanban: [], notes: [], reminders: [] }
      ),
    [categories]
  );

  if (!initialData || !settings) {
    return (
      <>
        <header className="border-b border-[#e1d8c8] pb-8">
          <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#111827] lg:text-4xl">Your workspace settings</h1>
        </header>
        <div className="mt-5 rounded-md border border-[#f0c7c1] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#944139]">
          {message || "Sign in to manage settings."}
        </div>
      </>
    );
  }

  function saveSettings(nextSettings: UserSettingsDTO) {
    setSettings(nextSettings);
    startTransition(async () => {
      setMessage("");
      try {
        const saved = await updateUserSettings(nextSettings);
        setSettings(saved);
        setMessage("Settings saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save settings.");
      }
    });
  }

  function patchSettings(patch: (current: UserSettingsDTO) => UserSettingsDTO) {
    if (!settings) {
      return;
    }
    saveSettings(patch(settings));
  }

  function resetCategoryForm(scope = categoryScope) {
    setEditingCategoryId(null);
    setCategoryForm({ scope, name: "", color: "#ef594a", icon: "Tag" });
  }

  function submitCategory() {
    const input = { ...categoryForm, scope: categoryScope };

    startTransition(async () => {
      setMessage("");
      try {
        if (editingCategoryId) {
          const updated = await updateUserCategory(editingCategoryId, input);
          setCategories((current) => current.map((category) => (category.id === updated.id ? updated : category)));
          resetCategoryForm(input.scope);
          setMessage("Category updated.");
          return;
        }

        const created = await createUserCategory(input);
        setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        resetCategoryForm(input.scope);
        setMessage("Category created.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save category.");
      }
    });
  }

  function editCategory(category: UserCategoryDTO) {
    setCategoryScope(category.scope);
    setEditingCategoryId(category.id);
    setCategoryForm({
      scope: category.scope,
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
  }

  function removeCategory(categoryId: number) {
    startTransition(async () => {
      setMessage("");
      try {
        await deleteUserCategory(categoryId);
        setCategories((current) => current.filter((category) => category.id !== categoryId));
        if (editingCategoryId === categoryId) {
          resetCategoryForm();
        }
        setMessage("Category deleted.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete category.");
      }
    });
  }

  function downloadExport() {
    startTransition(async () => {
      setMessage("");
      try {
        const data = await exportUserData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `flowbase-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setMessage("Export downloaded.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to export data.");
      }
    });
  }

  const profile = initialData.profile;
  const entitlements = initialData.entitlements;

  return (
    <>
      <header className="border-b border-[#e1d8c8] pb-8">
        <p className="flex items-center gap-2 text-sm font-bold text-[#d85749]">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#111827] lg:text-4xl">
              Tune Flowbase around the way you work.
            </h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[#5f5b55]">
              Manage profile details, categories, AI behavior, preferences, privacy, and billing in one calm place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveSettings(settings)}
            disabled={isPending}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save settings
          </button>
        </div>
      </header>

      {message ? (
        <div className="mt-4 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-4 py-3 text-sm font-semibold text-[#5f5b55]">
          {message}
        </div>
      ) : null}

      <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-lg border border-[#e1d8c8] bg-white p-3 shadow-[0_1px_2px_rgba(44,38,31,0.08)] lg:block">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-bold text-[#57534e] transition hover:bg-[#dff8f3]",
                    activeSection === section.id && "bg-[#fee4df] text-[#c94d42]"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{section.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <nav className="mb-5 flex gap-2 overflow-x-auto rounded-lg border border-[#e1d8c8] bg-white p-2 shadow-sm lg:hidden">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold text-[#57534e]",
                    activeSection === section.id && "bg-[#fee4df] text-[#c94d42]"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <div className="space-y-5">
            {activeSection === "profile" ? (
              <Card
                icon={UserRound}
                title="Profile"
                description="Clerk owns your account identity, while Flowbase syncs the latest profile snapshot."
                action={
                  <button
                    type="button"
                    onClick={() => clerk.openUserProfile()}
                    className="flex h-10 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
                  >
                    <Pencil className="h-4 w-4 text-[#ef594a]" aria-hidden="true" />
                    Edit profile
                  </button>
                }
              >
                <div className="flex min-w-0 flex-wrap items-center gap-4">
                  {profile.imageUrl ? (
                    <img src={profile.imageUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-[#24211f] text-xl font-bold text-white">
                      {profile.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-bold text-[#111827]">{profile.name}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#6b675f]">{profile.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md bg-[#dff8f0] px-3 py-1 text-xs font-bold text-[#28685c]">Synced with Clerk</span>
                      <span className="rounded-md bg-[#fff1c8] px-3 py-1 text-xs font-bold text-[#7c6227]">Personal workspace</span>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {activeSection === "subscription" ? (
              <>
                <Card
                  icon={CreditCard}
                  title="Subscription"
                  description="Billing is powered by Clerk user plans with Free and Pro access."
                  action={
                    <button
                      type="button"
                      onClick={() => (entitlements.isPro ? clerk.openUserProfile() : setShowPricing((value) => !value))}
                      className="flex h-10 items-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
                    >
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      {entitlements.isPro ? "Manage plan" : "Upgrade plan"}
                    </button>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4">
                      <p className="text-sm font-bold text-[#6b675f]">Current plan</p>
                      <p className="mt-2 text-3xl font-bold text-[#111827]">{entitlements.isPro ? "Pro" : "Free"}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                        {entitlements.isPro
                          ? "Full access is active for this account."
                          : "Free access is active with light usage limits."}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(entitlements.limits).map(([key, value]) => (
                        <div key={key} className="rounded-md border border-[#e8dfcf] bg-white p-3">
                          <p className="text-xs font-bold uppercase text-[#8a867d]">{key.replace(/([A-Z])/g, " $1")}</p>
                          <p className="mt-1 text-lg font-bold text-[#292524]">{entitlements.isPro ? "Unlimited" : value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                {showPricing && !entitlements.isPro ? (
                  <div className="overflow-hidden rounded-lg border border-[#e1d8c8] bg-white p-3 shadow-sm">
                    {clerkBillingEnabled ? (
                      <PricingTable />
                    ) : (
                      <div className="rounded-md border border-[#f0c7c1] bg-[#fff5f2] p-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#ef594a]" aria-hidden="true" />
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[#111827]">Clerk Billing is not enabled yet</h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">
                              Enable Billing in the Clerk dashboard, then set{" "}
                              <span className="font-mono text-[#944139]">NEXT_PUBLIC_CLERK_BILLING_ENABLED=true</span>{" "}
                              to render the upgrade table here.
                            </p>
                            <a
                              href="https://dashboard.clerk.com/last-active?path=billing/settings"
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#dc4d40]"
                            >
                              Open Clerk Billing
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeSection === "categories" ? (
              <Card icon={Tag} title="Dynamic categories" description="Create reusable labels for calendar, tasks, notes, and reminders.">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(Object.keys(scopeMeta) as CategoryScope[]).map((scope) => {
                    const meta = scopeMeta[scope];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => {
                          setCategoryScope(scope);
                          resetCategoryForm(scope);
                        }}
                        className={cn(
                          "flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold shadow-sm",
                          categoryScope === scope
                            ? "border-[#f0c7c1] bg-[#fee4df] text-[#c94d42]"
                            : "border-[#e1d8c8] bg-white text-[#57534e]"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", meta.color)} aria-hidden="true" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {groupedCategories[categoryScope].length ? (
                      groupedCategories[categoryScope].map((category) => (
                        <div key={category.id} className="min-w-0 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: category.color }}>
                                <CategoryIcon icon={category.icon} className="h-5 w-5" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#292524]">{category.name}</p>
                                <p className="mt-1 text-xs font-semibold capitalize text-[#6b675f]">{category.scope}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => editCategory(category)} className="grid h-8 w-8 place-items-center rounded-md text-[#6b675f] hover:bg-white hover:text-[#ef594a]" aria-label={`Edit ${category.name}`}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => removeCategory(category.id)} className="grid h-8 w-8 place-items-center rounded-md text-[#944139] hover:bg-white" aria-label={`Delete ${category.name}`}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState message="No categories in this section yet." />
                    )}
                  </div>

                  <div className="rounded-md border border-[#e8dfcf] bg-white p-4">
                    <h3 className="text-base font-bold text-[#171717]">{editingCategoryId ? "Edit category" : "New category"}</h3>
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2">
                        <FieldLabel>Name</FieldLabel>
                        <input
                          value={categoryForm.name}
                          onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                          className="h-11 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm font-bold outline-none focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                          placeholder="Category name"
                        />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Color</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setCategoryForm((current) => ({ ...current, color }))}
                              className={cn("h-8 w-8 rounded-md border-2", categoryForm.color === color ? "border-[#292524]" : "border-white")}
                              style={{ backgroundColor: color }}
                              aria-label={`Use ${color}`}
                            />
                          ))}
                          <input
                            type="color"
                            value={categoryForm.color}
                            onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))}
                            className="h-8 w-10 rounded-md border border-[#e1d8c8] bg-white"
                            aria-label="Custom category color"
                          />
                        </div>
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Icon</FieldLabel>
                        <select
                          value={categoryForm.icon}
                          onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))}
                          className="h-11 rounded-md border border-[#e1d8c8] bg-[#fffaf0] px-3 text-sm font-bold outline-none focus:border-[#ef594a] focus:ring-2 focus:ring-[#fee4df]"
                        >
                          {iconOptions.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={submitCategory}
                          disabled={isPending}
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#ef594a] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#dc4d40] disabled:opacity-60"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          {editingCategoryId ? "Update" : "Create"}
                        </button>
                        {editingCategoryId ? (
                          <button type="button" onClick={() => resetCategoryForm()} className="grid h-10 w-10 place-items-center rounded-md border border-[#e1d8c8] bg-white text-[#6b675f]">
                            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {activeSection === "ai" ? (
              <Card icon={WandSparkles} title="AI model settings" description="Set the default model, response shape, tone, and available AI tools.">
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    label="Preferred model"
                    value={settings.aiSettings.preferredModel}
                    options={["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]}
                    onChange={(value) => patchSettings((current) => ({ ...current, aiSettings: { ...current.aiSettings, preferredModel: value } }))}
                  />
                  <SelectField
                    label="Default behavior"
                    value={settings.aiSettings.defaultBehavior}
                    options={["balanced", "concise", "creative", "deep work"]}
                    onChange={(value) => patchSettings((current) => ({ ...current, aiSettings: { ...current.aiSettings, defaultBehavior: value } }))}
                  />
                  <SelectField
                    label="Tone"
                    value={settings.aiSettings.responseTone}
                    options={["friendly", "professional", "confident", "casual"]}
                    onChange={(value) => patchSettings((current) => ({ ...current, aiSettings: { ...current.aiSettings, responseTone: value } }))}
                  />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[
                    ["aiRefine", "AI Refine", "Improve selected note and page text."],
                    ["aiAssistant", "AI Assistant", "Enable assistant workflows when available."],
                    ["aiTemplateBuilder", "AI Template Builder", "Generate custom productivity mini apps."],
                    ["aiWhiteboard", "AI Whiteboard", "Generate whiteboard diagrams from prompts."],
                  ].map(([key, label, description]) => (
                    <Toggle
                      key={key}
                      label={label}
                      description={description}
                      checked={settings.aiSettings.features[key as keyof typeof settings.aiSettings.features]}
                      onChange={(checked) =>
                        patchSettings((current) => ({
                          ...current,
                          aiSettings: {
                            ...current.aiSettings,
                            features: { ...current.aiSettings.features, [key]: checked },
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </Card>
            ) : null}

            {activeSection === "preferences" ? (
              <>
                <Card icon={Palette} title="App preferences" description="Choose defaults used across your workspace.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField label="Theme" value={settings.themePreference} options={["system", "light", "dark"]} onChange={(value) => patchSettings((current) => ({ ...current, themePreference: value as UserSettingsDTO["themePreference"] }))} />
                    <SelectField label="Default calendar view" value={settings.defaultCalendarView} options={["month", "week"]} onChange={(value) => patchSettings((current) => ({ ...current, defaultCalendarView: value as UserSettingsDTO["defaultCalendarView"] }))} />
                    <SelectField label="Default task priority" value={settings.defaultTaskPriority} options={["Low", "Medium", "High"]} onChange={(value) => patchSettings((current) => ({ ...current, defaultTaskPriority: value as UserSettingsDTO["defaultTaskPriority"] }))} />
                    <Toggle label="Auto-save" description="Save supported workspace changes automatically." checked={settings.autoSave} onChange={(checked) => patchSettings((current) => ({ ...current, autoSave: checked }))} />
                  </div>
                </Card>
                <Card icon={Bell} title="Notifications" description="Control account-level notification defaults.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Toggle label="Email notifications" checked={settings.notificationSettings.email} onChange={(checked) => patchSettings((current) => ({ ...current, notificationSettings: { ...current.notificationSettings, email: checked } }))} />
                    <Toggle label="Desktop notifications" checked={settings.notificationSettings.desktop} onChange={(checked) => patchSettings((current) => ({ ...current, notificationSettings: { ...current.notificationSettings, desktop: checked } }))} />
                    <Toggle label="Reminder alerts" checked={settings.notificationSettings.reminders} onChange={(checked) => patchSettings((current) => ({ ...current, notificationSettings: { ...current.notificationSettings, reminders: checked } }))} />
                    <Toggle label="Weekly digest" checked={settings.notificationSettings.weeklyDigest} onChange={(checked) => patchSettings((current) => ({ ...current, notificationSettings: { ...current.notificationSettings, weeklyDigest: checked } }))} />
                  </div>
                </Card>
              </>
            ) : null}

            {activeSection === "security" ? (
              <>
                <Card icon={Shield} title="Privacy and security" description="Account security is managed by Clerk; these preferences control workspace behavior.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Toggle label="Two-factor reminder" description="Keep a visible reminder to review account security." checked={settings.privacySettings.twoFactorReminder} onChange={(checked) => patchSettings((current) => ({ ...current, privacySettings: { ...current.privacySettings, twoFactorReminder: checked } }))} />
                    <Toggle label="Show profile in shared spaces" checked={settings.privacySettings.showProfileInSharedSpaces} onChange={(checked) => patchSettings((current) => ({ ...current, privacySettings: { ...current.privacySettings, showProfileInSharedSpaces: checked } }))} />
                    <Toggle label="Product analytics" checked={settings.privacySettings.allowProductAnalytics} onChange={(checked) => patchSettings((current) => ({ ...current, privacySettings: { ...current.privacySettings, allowProductAnalytics: checked } }))} />
                    <button type="button" onClick={() => clerk.openUserProfile()} className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4 text-left text-sm font-bold text-[#292524]">
                      <span className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-[#ef594a]" aria-hidden="true" /> Account security</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </Card>
                <Card
                  icon={Database}
                  title="Data export"
                  description="Download a JSON export of your Flowbase workspace data."
                  action={
                    <button
                      type="button"
                      onClick={downloadExport}
                      disabled={isPending}
                      className="flex h-10 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-4 text-sm font-bold text-[#403c37] shadow-sm transition hover:border-[#ef594a] disabled:opacity-60"
                    >
                      <Download className="h-4 w-4 text-[#ef594a]" aria-hidden="true" />
                      Export data
                    </button>
                  }
                >
                  <div className="rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4 text-sm font-semibold leading-6 text-[#6b675f]">
                    Export includes profile snapshot, settings, categories, calendar tasks, kanban data, notes, whiteboards, generated apps, spaces, and pages.
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
