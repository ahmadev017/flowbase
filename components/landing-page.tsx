import {
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  MessageCircle,
  NotebookPen,
  Palette,
  Play,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  TableColumnsSplit,
  Users,
  WandSparkles,
  Waypoints,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { LandingAuthActions } from "@/components/auth-nav-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LandingIcon = typeof Sparkles;

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "AI", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const trustBadges = [
  { label: "AI Assistant", icon: Bot },
  { label: "Real-time Collaboration", icon: Users },
  { label: "Smart Workspace", icon: Sparkles },
];

const features = [
  {
    title: "AI Assistant",
    description: "Ask Flowbase to create tasks, schedule reminders, summarize notes, and route work across your workspace.",
    icon: Bot,
    color: "#8b5cf6",
    bg: "from-violet-50 to-white",
  },
  {
    title: "Smart Dashboard",
    description: "See tasks, schedule, recent pages, activity, and AI insights in one focused command center.",
    icon: LayoutDashboard,
    color: "#ef594a",
    bg: "from-rose-50 to-white",
  },
  {
    title: "Calendar & Reminders",
    description: "Plan dated tasks, save drafts, drag work into place, and keep every deadline visible.",
    icon: CalendarDays,
    color: "#168f79",
    bg: "from-teal-50 to-white",
  },
  {
    title: "Kanban / Task Boards",
    description: "Build team boards with priorities, labels, due dates, comments, and collaborative workflows.",
    icon: TableColumnsSplit,
    color: "#d08a21",
    bg: "from-amber-50 to-white",
  },
  {
    title: "Notion-style Notes",
    description: "Write structured docs with slash commands, rich formatting, checklists, and AI refinement.",
    icon: FileText,
    color: "#2d9cdb",
    bg: "from-sky-50 to-white",
  },
  {
    title: "Miro-style Whiteboard",
    description: "Sketch ideas, add sticky notes, export boards, and generate diagrams from prompts.",
    icon: Waypoints,
    color: "#dc6259",
    bg: "from-orange-50 to-white",
  },
  {
    title: "AI Template Builder",
    description: "Turn a prompt into a mini app, tracker, planner, or workflow template for repeated work.",
    icon: LayoutTemplate,
    color: "#db2777",
    bg: "from-pink-50 to-white",
  },
  {
    title: "Live Collaboration",
    description: "Share boards, see active presence, collect task comments, and keep teams in sync.",
    icon: Share2,
    color: "#55cdb4",
    bg: "from-emerald-50 to-white",
  },
  {
    title: "Custom Categories",
    description: "Tune colors, labels, and workspace categories so every team can organize work their way.",
    icon: Settings,
    color: "#64748b",
    bg: "from-slate-50 to-white",
  },
];

const showcaseItems = [
  {
    title: "Dashboard overview",
    description: "A live operating view for tasks, calendar, recent pages, and AI insights.",
    icon: LayoutDashboard,
    color: "#ef594a",
  },
  {
    title: "Notes editor",
    description: "Structured writing with AI refinement, slash commands, and voice capture.",
    icon: NotebookPen,
    color: "#2d9cdb",
  },
  {
    title: "Kanban board",
    description: "Boards, columns, labels, comments, collaborators, and due-date planning.",
    icon: FolderKanban,
    color: "#d08a21",
  },
  {
    title: "Whiteboard",
    description: "Visual thinking with sticky notes, diagrams, and export-ready canvases.",
    icon: Palette,
    color: "#dc6259",
  },
  {
    title: "AI Assistant",
    description: "A workspace-aware copilot that turns requests into organized actions.",
    icon: Bot,
    color: "#8b5cf6",
  },
];

const aiFeatures = [
  "Ask AI to create tasks",
  "Add calendar reminders",
  "Refine note content",
  "Generate diagrams",
  "Build mini apps/templates",
  "Get productivity insights",
];

const useCases = [
  { title: "Founders", detail: "Plan launches, shape product ideas, and keep operations moving.", icon: Zap, color: "#ef594a" },
  { title: "Students", detail: "Capture notes, map projects, schedule reminders, and study with AI.", icon: Lightbulb, color: "#2d9cdb" },
  { title: "Teams", detail: "Run shared boards, track comments, and collaborate in one workspace.", icon: Users, color: "#55cdb4" },
  { title: "Creators", detail: "Turn ideas into outlines, diagrams, content plans, and templates.", icon: WandSparkles, color: "#db2777" },
  { title: "Project managers", detail: "Coordinate tasks, timelines, priorities, and team context.", icon: ClipboardList, color: "#d08a21" },
  { title: "Personal productivity", detail: "Build a calm system for notes, tasks, reminders, and goals.", icon: CheckCircle2, color: "#168f79" },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    description: "For getting your personal workspace organized.",
    features: ["Core dashboard", "Notes and Kanban", "Calendar reminders", "Starter AI requests"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    description: "For power users building a complete AI productivity system.",
    features: ["Unlimited notes and boards", "AI Assistant workflows", "AI Template Builder", "Advanced whiteboards"],
    cta: "Get Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    description: "For teams that need collaboration, shared context, and visibility.",
    features: ["Shared Kanban boards", "Live presence", "Task comments", "Team workspace controls"],
    cta: "Start team",
    highlighted: false,
  },
];

const testimonials = [
  {
    quote: "Flowbase feels like the workspace we kept trying to assemble from five different tools.",
    name: "Maya Chen",
    role: "Founder, Northstar Labs",
  },
  {
    quote: "The AI assistant is useful because it understands the work system around the request, not just the prompt.",
    name: "Jordan Ellis",
    role: "Product Lead, AtlasWorks",
  },
  {
    quote: "Our planning meetings got shorter because boards, notes, whiteboards, and decisions now live together.",
    name: "Priya Raman",
    role: "Operations Director, Studio Vale",
  },
];

const faqs = [
  {
    question: "What can the AI Assistant do?",
    answer: "It can help create tasks, plan reminders, summarize and refine notes, generate diagrams, and build lightweight templates from natural language.",
  },
  {
    question: "Does Flowbase support collaboration?",
    answer: "Yes. Flowbase includes shared Kanban boards, active user presence, task comments, and a Liveblocks-powered collaboration experience.",
  },
  {
    question: "Are notes built for serious writing?",
    answer: "Yes. The notes workspace supports rich formatting, slash commands, checklists, AI refinement, and voice-to-note capture.",
  },
  {
    question: "How does the whiteboard work?",
    answer: "The whiteboard is built for visual planning with sticky notes, sketching, AI-generated diagrams, saved boards, and PNG export.",
  },
  {
    question: "What is the AI Template Builder?",
    answer: "It turns prompts into mini productivity apps such as trackers, planners, dashboards, checklists, and repeatable workflow templates.",
  },
  {
    question: "How is data privacy handled?",
    answer: "Flowbase is designed around signed-in workspaces and user-owned content. Sensitive workspace actions stay tied to the authenticated account.",
  },
];

function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("mx-auto max-w-3xl", align === "center" ? "text-center" : "mx-0 text-left")}>
      <p className="inline-flex items-center gap-2 rounded-md border border-[#e8dfcf] bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#d85749] shadow-sm">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="mt-4 text-base font-semibold leading-7 text-[#6b675f] sm:text-lg">{description}</p>
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#eadfce] bg-[#fbf6ea]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Flowbase home">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ef594a] text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black text-[#111827]">Flowbase</span>
            <span className="block truncate text-xs font-bold text-[#77736b]">AI workspace</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-bold text-[#57534e] transition hover:bg-white hover:text-[#ef594a]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <LandingAuthActions />
      </div>
    </header>
  );
}

function DashboardMockup() {
  const dashboardNavItems: Array<{ label: string; icon: LandingIcon; color: string }> = [
    { label: "Dashboard", icon: LayoutDashboard, color: "#ef594a" },
    { label: "Assistant", icon: Bot, color: "#8b5cf6" },
    { label: "Calendar", icon: CalendarDays, color: "#168f79" },
    { label: "Kanban", icon: TableColumnsSplit, color: "#d08a21" },
    { label: "Notes", icon: FileText, color: "#2d9cdb" },
    { label: "Whiteboard", icon: Waypoints, color: "#dc6259" },
  ];

  return (
    <div className="relative">
      <div className="max-h-[180px] overflow-hidden rounded-lg border border-[#e1d8c8] bg-white/80 p-2 shadow-[0_24px_80px_rgba(44,38,31,0.16)] backdrop-blur sm:max-h-[420px] lg:max-h-[600px]">
        <div className="overflow-hidden rounded-lg border border-[#e8dfcf] bg-[#fffdf8]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e8dfcf] bg-[#fffaf0] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ef594a]" />
              <span className="h-3 w-3 rounded-full bg-[#f4b333]" />
              <span className="h-3 w-3 rounded-full bg-[#55cdb4]" />
            </div>
            <span className="rounded-md border border-[#e1d8c8] bg-white px-3 py-1 text-xs font-black text-[#6b675f]">
              Live workspace
            </span>
          </div>

          <div className="grid min-h-[420px] gap-0 lg:grid-cols-[200px_minmax(0,1fr)]">
            <aside className="hidden border-r border-[#e8dfcf] bg-[#fffaf0] p-4 lg:block">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ef594a] text-white">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black text-[#111827]">Nova team</p>
                  <p className="text-xs font-bold text-[#77736b]">Pro workspace</p>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                {dashboardNavItems.map(({ label, icon: LucideIcon, color }) => {
                  return (
                    <div key={label} className="flex h-10 items-center gap-3 rounded-md bg-white px-3 shadow-sm">
                      <LucideIcon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                      <span className="text-xs font-black text-[#57534e]">{label}</span>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#d85749]">AI command center</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#111827]">Build the week with one prompt.</h3>
                </div>
                <div className="flex -space-x-2">
                  {["M", "J", "P"].map((initial, index) => (
                    <span
                      key={initial}
                      className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-black text-white"
                      style={{ backgroundColor: ["#ef594a", "#55cdb4", "#8b5cf6"][index] }}
                    >
                      {initial}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Tasks done", "42%", "#ef594a"],
                  ["Upcoming", "8", "#168f79"],
                  ["AI actions", "16", "#8b5cf6"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-lg border border-[#e8dfcf] bg-white p-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8a867d]">{label}</p>
                    <p className="mt-3 text-3xl font-black text-[#111827]">{value}</p>
                    <div className="mt-3 h-2 rounded-full bg-[#f1eadf]">
                      <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-lg border border-[#e8dfcf] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-[#292524]">Launch board</p>
                    <span className="rounded-md bg-[#eefbf7] px-2 py-1 text-xs font-black text-[#28685c]">Live</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {["Todo", "Doing", "Done"].map((column, index) => (
                      <div key={column} className="rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-3">
                        <p className="text-xs font-black text-[#6b675f]">{column}</p>
                        <div className="mt-3 space-y-2">
                          {Array.from({ length: index === 2 ? 1 : 2 }).map((_, taskIndex) => (
                            <div key={`${column}-${taskIndex}`} className="rounded-md border border-[#e1d8c8] bg-white p-3 shadow-sm">
                              <div className="h-2 w-2/3 rounded-full bg-[#292524]" />
                              <div className="mt-2 h-2 w-1/2 rounded-full bg-[#d8cdbb]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#e8dfcf] bg-[#111827] p-4 text-white shadow-sm">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-[#c4b5fd]" aria-hidden="true" />
                    <p className="font-black">Flowbase AI</p>
                  </div>
                  <div className="mt-4 rounded-md bg-white/10 p-3 text-sm font-semibold leading-6 text-white/90">
                    Create a sprint board, add launch tasks, schedule design review, and summarize the project notes.
                  </div>
                  <div className="mt-3 space-y-2 text-xs font-black">
                    {["Task board created", "Calendar reminder added", "Notes refined"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                        <Check className="h-3.5 w-3.5 text-[#55cdb4]" aria-hidden="true" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#eadfce] bg-[#fbf6ea]">
      <div className="absolute inset-0 opacity-[0.45] [background-image:linear-gradient(#e8dfcf_1px,transparent_1px),linear-gradient(90deg,#e8dfcf_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-3xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#d85749] shadow-sm">
              <Brain className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">AI-native productivity workspace</span>
            </div>
            <h1 className="mt-5 text-3xl font-black leading-[1.05] tracking-tight text-[#111827] sm:text-5xl lg:text-5xl">
              Your AI-Powered Workspace for Notes, Tasks, Whiteboards, and Team Collaboration
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#5f5b55] sm:mt-5 sm:text-lg sm:leading-8">
              Flowbase brings Notion-style notes, Miro-style whiteboards, Kanban boards, calendar reminders,
              AI templates, and real-time teamwork into one calm modern platform.
            </p>

            <div className="mt-6 flex gap-3 sm:mt-7">
              <Button asChild className="h-11 flex-1 bg-[#ef594a] px-4 text-sm font-black text-white shadow-sm hover:bg-[#dc4d40] sm:h-12 sm:flex-none sm:px-6 sm:text-base">
                <Link href="/sign-up">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1 border-[#e1d8c8] bg-white px-4 text-sm font-black text-[#403c37] shadow-sm hover:border-[#ef594a] hover:bg-white sm:h-12 sm:flex-none sm:px-6 sm:text-base">
                <Link href="#showcase">
                  <Play className="mr-2 h-5 w-5 text-[#8b5cf6]" aria-hidden="true" />
                  Watch Demo
                </Link>
              </Button>
            </div>

            <div className="mt-5 flex gap-3 overflow-x-auto pb-1 sm:mt-7 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <span key={badge.label} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white/80 px-3 py-2 text-sm font-black text-[#403c37] shadow-sm backdrop-blur">
                    <Icon className="h-4 w-4 text-[#ef594a]" aria-hidden="true" />
                    {badge.label}
                  </span>
                );
              })}
            </div>
          </div>

          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section id="features" className="bg-[#fffdf8] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Feature highlights"
          title="One workspace for the way modern teams actually think."
          description="Plan, write, map, schedule, automate, and collaborate without scattering context across disconnected tools."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className={cn(
                  "group rounded-lg border-[#e8dfcf] bg-gradient-to-br shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#efc7bf] hover:shadow-xl",
                  feature.bg
                )}
              >
                <CardContent className="p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-white shadow-sm">
                    <Icon className="h-5 w-5" style={{ color: feature.color }} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-[#111827]">{feature.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#6b675f]">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { title: "Organize your workspace", detail: "Start with boards, notes, calendars, whiteboards, and spaces that match your workflow.", icon: LayoutDashboard },
    { title: "Let AI help you plan and create", detail: "Ask Flowbase to turn ideas into tasks, reminders, refined notes, diagrams, and templates.", icon: Sparkles },
    { title: "Collaborate and track progress", detail: "Invite teammates, comment on tasks, watch presence, and keep momentum visible.", icon: Users },
  ];

  return (
    <section className="bg-[#fbf6ea] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="How it works"
          title="From messy ideas to organized progress in three steps."
          description="Flowbase gives every idea a place to land, every task a next step, and every team a shared rhythm."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-lg border border-[#e1d8c8] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-center justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#fee4df] text-[#c94d42]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-4xl font-black text-[#efe5d6]">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-black text-[#111827]">{step.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#6b675f]">{step.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductShowcase() {
  return (
    <section id="showcase" className="bg-[#111827] px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <SectionHeader
            align="left"
            eyebrow="Product showcase"
            title="A complete productivity operating system, previewed in one flow."
            description="The product surface is designed around focused work: a calm dashboard, precise planning tools, rich creation spaces, and AI support when you need leverage."
          />
          <div className="rounded-lg border border-white/15 bg-white/8 p-3 shadow-2xl backdrop-blur">
            <div className="rounded-lg border border-white/10 bg-[#fffdf8] p-4 text-[#111827]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8dfcf] pb-4">
                <div>
                  <p className="text-sm font-black text-[#d85749]">Today in Flowbase</p>
                  <h3 className="mt-1 text-2xl font-black">Launch workspace</h3>
                </div>
                <span className="rounded-md bg-[#eefbf7] px-3 py-1 text-xs font-black text-[#28685c]">5 teammates active</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#e8dfcf] bg-white p-4 shadow-sm">
                  <p className="font-black text-[#292524]">Notes editor</p>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-4/5 rounded-full bg-[#111827]" />
                    <div className="h-2 w-full rounded-full bg-[#e1d8c8]" />
                    <div className="h-2 w-5/6 rounded-full bg-[#e1d8c8]" />
                    <div className="mt-4 rounded-md bg-[#f5fbff] p-3 text-xs font-black text-[#2d6f91]">
                      AI refined: clearer launch brief
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-[#e8dfcf] bg-white p-4 shadow-sm">
                  <p className="font-black text-[#292524]">Whiteboard</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-[#fff0bd] p-3 text-xs font-black text-[#7c6227]">Idea map</div>
                    <div className="rounded-md bg-[#dff8f3] p-3 text-xs font-black text-[#28685c]">System flow</div>
                    <div className="rounded-md bg-[#ece5ff] p-3 text-xs font-black text-[#5b3db8]">Risks</div>
                    <div className="rounded-md bg-[#fee4df] p-3 text-xs font-black text-[#944139]">Next steps</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {showcaseItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-white/15 bg-white/8 p-5 transition hover:-translate-y-1 hover:bg-white/12">
                <Icon className="h-6 w-6" style={{ color: item.color }} aria-hidden="true" />
                <h3 className="mt-4 text-base font-black">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/70">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AIWorkflowSection() {
  return (
    <section id="ai" className="bg-[#fffdf8] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeader
          align="left"
          eyebrow="AI features"
          title="AI that creates inside your workspace, not outside it."
          description="Flowbase AI turns intent into organized work across tasks, calendars, notes, diagrams, templates, and dashboard insights."
        />
        <div className="rounded-lg border border-[#e1d8c8] bg-[#fbf6ea] p-4 shadow-xl">
          <div className="rounded-lg border border-[#e8dfcf] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#ece5ff] text-[#7c3aed]">
                <Bot className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#111827]">Flowbase AI Assistant</h3>
                <p className="text-sm font-bold text-[#6b675f]">Workspace-aware planning</p>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-[#e8dfcf] bg-[#fffaf0] p-4 text-sm font-semibold leading-7 text-[#403c37]">
              Plan my product launch: create a Kanban board, add calendar reminders, refine the launch note, and generate a customer onboarding diagram.
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {aiFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-md border border-[#e8dfcf] bg-white px-3 py-3 text-sm font-black text-[#403c37] shadow-sm">
                  <Check className="h-4 w-4 shrink-0 text-[#168f79]" aria-hidden="true" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CollaborationSection() {
  const items = [
    "Shared Kanban boards",
    "Active user presence",
    "Task comments",
    "Liveblocks-powered collaboration",
    "Team workspace experience",
  ];

  return (
    <section className="bg-[#fbf6ea] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-xl">
          <div className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#d85749]">Team launch board</p>
                <h3 className="mt-1 text-2xl font-black text-[#111827]">Real-time collaboration</h3>
              </div>
              <div className="flex -space-x-2">
                {["A", "K", "R", "S"].map((initial, index) => (
                  <span
                    key={initial}
                    className="grid h-10 w-10 place-items-center rounded-full border-2 border-white text-xs font-black text-white"
                    style={{ backgroundColor: ["#ef594a", "#55cdb4", "#8b5cf6", "#2d9cdb"][index] }}
                  >
                    {initial}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {["Review design system", "Publish launch note", "Schedule customer calls"].map((task, index) => (
                <div key={task} className="rounded-md border border-[#e8dfcf] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black text-[#292524]">{task}</p>
                    <span className="rounded-md px-2 py-1 text-xs font-black" style={{ backgroundColor: ["#fee4df", "#eefbf7", "#fff7dd"][index], color: ["#944139", "#28685c", "#7c6227"][index] }}>
                      {["High", "Active", "Due soon"][index]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#6b675f]">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {index + 2} comments
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <SectionHeader
            align="left"
            eyebrow="Collaboration"
            title="Keep the whole team moving from the same source of truth."
            description="Flowbase combines shared planning surfaces with presence and comments so teams can align without creating more operational drag."
          />
          <div className="mt-6 grid gap-3">
            {items.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-[#e1d8c8] bg-white px-4 py-3 text-sm font-black text-[#403c37] shadow-sm">
                <Users className="h-4 w-4 text-[#55cdb4]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <section className="bg-[#fffdf8] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Use cases"
          title="Built for every kind of knowledge work."
          description="Flowbase adapts to solo focus, team delivery, creative planning, study systems, and cross-functional project work."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-[#e8dfcf] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <Icon className="h-6 w-6" style={{ color: item.color }} aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black text-[#111827]">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b675f]">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="bg-[#fbf6ea] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Start simple. Scale into a complete team workspace."
          description="Choose the plan that fits your productivity system today, then expand when your team needs more shared context."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-lg border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
                plan.highlighted ? "border-[#ef594a] ring-4 ring-[#fee4df]" : "border-[#e1d8c8]"
              )}
            >
              {plan.highlighted ? (
                <span className="inline-flex rounded-md bg-[#fee4df] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#944139]">
                  Most popular
                </span>
              ) : null}
              <h3 className="mt-5 text-2xl font-black text-[#111827]">{plan.name}</h3>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-5xl font-black tracking-tight text-[#111827]">{plan.price}</span>
                <span className="pb-2 text-sm font-bold text-[#6b675f]">/mo</span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-[#6b675f]">{plan.description}</p>
              <Button asChild className={cn("mt-6 h-11 w-full font-black", plan.highlighted ? "bg-[#ef594a] text-white hover:bg-[#dc4d40]" : "bg-[#111827] text-white hover:bg-[#292524]")}>
                <Link href="/sign-up">{plan.cta}</Link>
              </Button>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm font-bold text-[#403c37]">
                    <Check className="h-4 w-4 shrink-0 text-[#168f79]" aria-hidden="true" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="bg-[#fffdf8] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Testimonials"
          title="Teams choose Flowbase when work needs more than another checklist."
          description="Placeholder stories from teams using Flowbase to unify thinking, planning, and delivery."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.name} className="rounded-lg border border-[#e8dfcf] bg-white p-6 shadow-sm">
              <div className="flex gap-1 text-[#f4b333]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                ))}
              </div>
              <blockquote className="mt-5 text-base font-bold leading-7 text-[#292524]">"{testimonial.quote}"</blockquote>
              <figcaption className="mt-6 border-t border-[#e8dfcf] pt-5">
                <p className="font-black text-[#111827]">{testimonial.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#6b675f]">{testimonial.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="bg-[#fbf6ea] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="FAQ"
          title="Questions before you build your workspace?"
          description="A quick overview of Flowbase AI, collaboration, notes, whiteboards, templates, and privacy."
        />
        <div className="mt-10 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-black text-[#111827]">
                {faq.question}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fffaf0] text-[#ef594a] transition group-open:rotate-45">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="mt-4 text-sm font-semibold leading-7 text-[#6b675f]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="bg-[#111827] px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-lg border border-white/15 bg-white/8 p-8 text-center shadow-2xl backdrop-blur sm:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-[#ef594a] text-white shadow-sm">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
          Build your entire productivity system in one AI workspace
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-white/70">
          Replace scattered tools with a calm, connected workspace for planning, writing, mapping, building, and collaborating.
        </p>
        <Button asChild className="mt-8 h-12 bg-[#ef594a] px-7 text-base font-black text-white hover:bg-[#dc4d40]">
          <Link href="/sign-up">
            Start for Free
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  const columns = [
    { title: "Product", links: ["AI Assistant", "Dashboard", "Notes", "Kanban", "Whiteboard"] },
    { title: "Resources", links: ["Demo", "Templates", "Guides", "Changelog", "Support"] },
    { title: "Legal", links: ["Privacy", "Terms", "Security", "Data policy", "Status"] },
  ];

  return (
    <footer className="border-t border-[#e1d8c8] bg-[#fffdf8] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ef594a] text-white">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-black text-[#111827]">Flowbase</span>
              <span className="block text-sm font-bold text-[#6b675f]">AI-powered productivity workspace</span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm font-semibold leading-6 text-[#6b675f]">
            Notes, tasks, whiteboards, calendar planning, AI templates, and real-time collaboration in one modern workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {["LinkedIn", "X", "GitHub"].map((item) => (
              <Link key={item} href="#" className="rounded-md border border-[#e1d8c8] bg-white px-3 py-2 text-sm font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]">
                {item}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#8a867d]">{column.title}</h3>
              <div className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <Link key={link} href="#" className="block text-sm font-bold text-[#57534e] transition hover:text-[#ef594a]">
                    {link}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-[#e8dfcf] pt-6 text-sm font-semibold text-[#77736b] sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright 2026 Flowbase. All rights reserved.</p>
        <p className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#168f79]" aria-hidden="true" />
          Built for secure AI-assisted workspaces
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#111827]">
      <Navbar />
      <HeroSection />
      <FeatureSection />
      <HowItWorksSection />
      <ProductShowcase />
      <AIWorkflowSection />
      <CollaborationSection />
      <UseCasesSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
    </main>
  );
}
