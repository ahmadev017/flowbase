import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell>
      <div className="space-y-7">
        <header className="border-b border-[#e1d8c8] pb-8">
          <div className="h-4 w-28 rounded bg-[#eadfce]" />
          <div className="mt-4 h-10 max-w-3xl rounded bg-[#eadfce]" />
          <div className="mt-3 h-5 max-w-xl rounded bg-[#f0e7d8]" />
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 rounded-lg border border-[#e1d8c8] bg-white p-5 shadow-sm">
              <Sparkles className="h-5 w-5 animate-pulse text-[#d8cdbb]" aria-hidden="true" />
              <div className="mt-5 h-5 w-32 rounded bg-[#eee4d5]" />
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="h-12 rounded bg-[#fffaf0]" />
                <div className="h-12 rounded bg-[#fffaf0]" />
                <div className="h-12 rounded bg-[#fffaf0]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
