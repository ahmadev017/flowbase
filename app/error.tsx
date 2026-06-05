"use client";

import { AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <section className="grid min-h-[60vh] place-items-center">
        <Card className="w-full max-w-[560px] rounded-lg border-[#e1d8c8] bg-white shadow-[0_1px_2px_rgba(44,38,31,0.08)]">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#fff0ed] text-[#944139]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="pt-3 text-2xl font-bold text-[#111827]">Dashboard could not load</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold leading-7 text-[#6b675f]">
              {error.message || "Something went wrong while loading your workspace overview."}
            </p>
            <Button onClick={reset} className="mt-5 bg-[#ef594a] font-bold text-white hover:bg-[#dc4d40]">
              Try again
            </Button>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
