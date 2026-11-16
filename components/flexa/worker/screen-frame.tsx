"use client";

import type { ReactNode } from "react";
import { TopBar } from "@/components/flexa/app-shell";
import { Backdrop } from "@/components/flexa/shapes";

// Inner screen chrome (backdrop + top bar + padded column) for routes that render their
// own loading and error states before the real content is known.
export function ScreenFrame({ title, back, children, action }: { title: string; back?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <>
      <Backdrop variant="inner" />
      <TopBar title={title} back={back} action={action} />
      <main className="flex flex-col gap-4 px-5 pt-3 pb-10">{children}</main>
    </>
  );
}
