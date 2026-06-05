"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut, LayoutDashboard, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function LandingAuthActions() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-10 w-28 rounded-md border border-[#e1d8c8] bg-white/70" />
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          className="hidden h-10 font-bold text-[#403c37] hover:bg-white hover:text-[#ef594a] sm:inline-flex"
        >
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4 text-[#ef594a]" aria-hidden="true" />
            Dashboard
          </Link>
        </Button>
        <SignOutButton redirectUrl="/">
          <Button className="h-10 bg-[#111827] px-4 font-black text-white shadow-sm hover:bg-[#292524]">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        asChild
        variant="ghost"
        className="hidden h-10 font-bold text-[#403c37] hover:bg-white hover:text-[#ef594a] sm:inline-flex"
      >
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild className="h-10 bg-[#ef594a] px-4 font-black text-white shadow-sm hover:bg-[#dc4d40]">
        <Link href="/sign-up">
          Start free
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
