import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { GeneratedAppPreview } from "@/components/generated-app-preview";

import { GeneratedAppDTO, getGeneratedApp } from "../actions";

export default async function GeneratedAppRoute({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const numericId = Number(appId);
  let app: GeneratedAppDTO | null = null;
  let errorMessage = "";

  try {
    if (!Number.isInteger(numericId)) {
      throw new Error("Generated app not found.");
    }
    app = await getGeneratedApp(numericId);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load generated app.";
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <Link
          href="/ai-template-builder"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e1d8c8] bg-white px-3 text-sm font-black text-[#403c37] shadow-sm transition hover:border-[#ef594a]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to builder
        </Link>

        {app ? (
          <GeneratedAppPreview app={app} />
        ) : (
          <div className="grid min-h-[520px] place-items-center rounded-lg border border-dashed border-[#d8cdbb] bg-[#fffaf0] p-6 text-center">
            <div className="max-w-[380px]">
              <h1 className="text-2xl font-black text-[#292524]">Generated app unavailable</h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#6b675f]">
                {errorMessage || "This generated app may have been deleted or belongs to another account."}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
