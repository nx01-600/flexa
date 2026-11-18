"use client";

import type { ReactNode } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";
import { cn } from "@/lib/utils";

// Inner screen chrome (backdrop + top bar + padded column) for routes that render their
// own loading and error states before the real content is known.
// Width: back-header screens sit in the 760px md+ frame of app/app/layout.tsx, so <main>
// needs no max-width. `className` is the hook for a md+ grid, e.g. "md:grid md:grid-cols-2".
export function ScreenFrame({ title, back, children, action, className }: { title: string; back?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title={title} back={back} action={action} />
      <main className={cn("flex flex-col gap-4 px-5 pt-3 pb-10", className)}>{children}</main>
    </>
  );
}
