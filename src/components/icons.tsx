/** Minimal inline stroke icons (24×24 viewBox). */
import type { SVGProps } from "react";

function Base({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const Icons = {
  dashboard: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Base>
  ),
  markets: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
    </Base>
  ),
  signals: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </Base>
  ),
  chart: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M8 4v16M16 4v16" />
      <rect x="6" y="7" width="4" height="8" rx="1" />
      <rect x="14" y="9" width="4" height="6" rx="1" />
    </Base>
  ),
  backtest: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5M12 8v4l3 2" />
    </Base>
  ),
  analytics: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Base>
  ),
  risk: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12h6M12 9v6" />
    </Base>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Base>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Base>
  ),
  sun: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Base>
  ),
  moon: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Base>
  ),
  menu: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  ),
  close: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  ),
  check: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="m5 12 5 5 9-10" />
    </Base>
  ),
  x: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M7 7l10 10M17 7 7 17" />
    </Base>
  ),
  refresh: (p: SVGProps<SVGSVGElement>) => (
    <Base {...p}>
      <path d="M20 11a8 8 0 0 0-14.9-4M4 13a8 8 0 0 0 14.9 4" />
      <path d="M4 3v4h4M20 21v-4h-4" />
    </Base>
  ),
};
