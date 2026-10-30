import { cn } from "@/lib/utils";

// Smooth organic outlines drawn in a 200x200 box. preserveAspectRatio="none"
// lets one path become a round blob or a wide slab depending on the box size.
const paths = [
  "M145.3 41.4c12.5 10.8 20.8 26.7 24.8 44 4 17.3 3.7 36-4.9 50.2-8.6 14.2-25.5 23.9-43.3 30.2-17.8 6.3-36.5 9.2-53.2 3.3-16.7-5.9-31.4-20.6-39.1-38.2-7.7-17.6-8.4-38.1-1.4-55.3 7-17.2 21.7-31.1 37.7-41.2 16-10.1 33.2-16.4 49.2-14.3 16 2.1 17.7 10.5 30.2 21.3Z",
  "M138.9 50.4c11.6 11 20.7 23.9 25.2 39.3 4.5 15.4 4.4 33.3-4 46.5-8.4 13.2-25.1 21.8-42.7 27.4-17.6 5.6-36.1 8.3-51-1.4-14.9-6.7-26.2-22.7-32.6-40.2-6.4-17.5-7.9-36.5-.8-51.6 7.1-15.1 22.8-26.3 38.1-35.9 15.3-9.6 30.2-17.6 43.5-14.2 13.3 3.4 12.7 16.1 24.3 30.1Z",
  "M152.4 37.9c13.9 11.6 22.2 29.8 24 48.2 1.8 18.4-2.9 37-13.8 50.3-10.9 13.3-28 21.3-46.3 27.4-18.3 6.1-37.8 10.3-52.8 3.2-15-7.1-25.5-25.5-32.1-45.1-6.6-19.6-9.3-40.4-1-55.8 8.3-15.4 27.6-25.4 45.8-35.7 18.2-10.3 35.3-20.9 50.4-17.8 15.1 3.1 11.9 13.7 25.8 25.3Z",
];

const tones = {
  green: ["#d3e9ce", "#e9f4e6"],
  deep: ["#c2e0bc", "#dcefd8"],
  pink: ["#f8c9c4", "#fde8e6"],
};

type Tone = keyof typeof tones;

// One feathered blob. Size and position come from className (absolute, w, h).
export function Blob({ shape = 0, tone = "green", className }: { shape?: 0 | 1 | 2; tone?: Tone; className?: string }) {
  const id = `flexa-blob-${tone}`;
  const [from, to] = tones[tone];
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden className={cn("pointer-events-none absolute blur-[2px]", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={paths[shape]} fill={`url(#${id})`} />
    </svg>
  );
}

type Spec = { shape: 0 | 1 | 2; tone?: Tone; className: string };

// Presets per surface. Sizes follow the audit: blobs 45-65% of a phone's width,
// large slabs bleeding off the edges on desktop.
const presets: Record<string, Spec[]> = {
  // mobile login: top-right and bottom-left, plus a glow behind the logo
  login: [
    { shape: 0, tone: "deep", className: "-top-20 -right-24 size-[280px] opacity-75" },
    { shape: 2, className: "-bottom-16 -left-28 h-[300px] w-[340px] opacity-90" },
    { shape: 1, className: "-right-32 bottom-[18%] size-[220px] opacity-50" },
  ],
  // worker home: behind the avatar and bleeding behind the balance card
  home: [
    { shape: 1, tone: "deep", className: "-top-20 -right-24 size-[240px] opacity-70" },
    { shape: 2, className: "top-[190px] -right-20 size-[220px] opacity-80" },
  ],
  // inner worker screens: one anchor top-right
  inner: [{ shape: 0, className: "-top-24 -right-20 size-[230px] opacity-80" }],
  // desktop canvas (index, empresas shell)
  page: [
    { shape: 2, className: "-top-40 -left-40 h-[360px] w-[520px] opacity-80" },
    { shape: 0, className: "-right-48 -bottom-56 h-[480px] w-[600px] opacity-70" },
  ],
  // desktop login: top-left, bottom-left, tilted slab behind the card
  split: [
    { shape: 2, className: "-top-44 -left-44 h-[380px] w-[540px] opacity-90" },
    { shape: 1, className: "-bottom-40 -left-32 h-[300px] w-[440px] opacity-80" },
    { shape: 0, tone: "deep", className: "-right-40 -bottom-48 size-[620px] rotate-[18deg] opacity-60" },
  ],
  // liquidity warning
  warning: [
    { shape: 0, tone: "pink", className: "-top-24 -right-28 size-[280px] opacity-60" },
    { shape: 2, tone: "pink", className: "-bottom-24 -left-28 size-[260px] opacity-50" },
  ],
};

export type BackdropVariant = keyof typeof presets;

// Decorative layer behind a screen. Parent must be `relative isolate` (or the
// variant uses `fixed`); the layer sits at -z-10 so content stays on top.
export function Backdrop({ variant, fixed, wash, className }: { variant: BackdropVariant; fixed?: boolean; wash?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none inset-0 -z-10 overflow-hidden", fixed ? "fixed" : "absolute", wash && "bg-wash", className)}>
      {presets[variant].map((b, i) => (
        <Blob key={i} {...b} />
      ))}
    </div>
  );
}
