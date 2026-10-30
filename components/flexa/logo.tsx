import { cn } from "@/lib/utils";

// Wordmark redrawn as geometry. The three rays sit centered over the apex of
// the A (the mockup had them shifted left; fixing that was requested).
export function Logo({ className, rays = true }: { className?: string; rays?: boolean }) {
  return (
    <svg
      viewBox="0 0 176 56"
      role="img"
      aria-label="Flexa"
      className={cn("h-8 w-auto", className)}
      fill="none"
      strokeWidth={5.5}
      strokeLinejoin="miter"
    >
      <g stroke="var(--color-ink)">
        <path d="M4 16v36M4 18.75h22M4 34h18" />
        <path d="M36 16v33.25h21" />
        <path d="M91 18.75H69.75v30.5H91M69.75 34H87" />
        <path d="M101 16l26 36M127 16l-26 36" />
        <path d="M136 52l17-35 17 35" />
      </g>
      {rays && (
        <g stroke="var(--color-green-500)" strokeWidth={4} strokeLinecap="round">
          <path d="M153 2.5v6.5" />
          <path d="M142.5 6l3.2 4.6" />
          <path d="M163.5 6l-3.2 4.6" />
        </g>
      )}
    </svg>
  );
}

export function LogoEmpresas({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-2", className)}>
      <Logo className="h-7" />
      <span className="pb-px text-sm font-bold text-green-700">Empresas</span>
    </span>
  );
}
