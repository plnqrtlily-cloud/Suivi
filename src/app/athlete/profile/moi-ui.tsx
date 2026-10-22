import Link from "next/link";
import { Nav } from "@/components/nav";
import type { User } from "@/lib/auth";

// Gabarit des sous-pages de « Moi » : retour vers Moi, titre, sous-titre.
export function SubPage({
  user,
  title,
  subtitle,
  children,
}: {
  user: User;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f2f4f3]">
      <Nav user={user} />
      <main className="mx-auto flex max-w-xl flex-col pb-28 lg:pb-10">
        <div className="px-4 pt-4">
          <Link href="/athlete/profile" className="inline-flex items-center gap-1 text-[15px] font-semibold text-moss-dark">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5l-5 5 5 5" />
            </svg>
            Moi
          </Link>
        </div>
        <header className="px-5 pb-4 pt-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-slate">{subtitle}</p>}
        </header>
        <div className="flex flex-col gap-3.5 px-4">{children}</div>
      </main>
    </div>
  );
}

export function Panel({ title, children, hint }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      {title && (
        <div>
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export const ICONS = {
  zones: "M3 15h3V9H3zM8.5 15h3V5h-3zM14 15h3v-8h-3z",
  tests: "M4 16l4-5 3 3 5-8",
  star: "M10 3.5l2 4.2 4.5.6-3.3 3.1.8 4.5L10 13.7l-4 2.2.8-4.5L3.5 8.3 8 7.7z",
  grid: "M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z",
  health: "M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0110 6.3a3.3 3.3 0 016 2c0 4.6-6 8.2-6 8.2z",
  drop: "M10 3.5s-4.5 5-4.5 8.2a4.5 4.5 0 009 0C14.5 8.5 10 3.5 10 3.5z",
  coach: "M7 9.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2zM14 10.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M11.5 15.5c.5-1.8 1.6-2.8 3-2.8s2.5 1 3 2.8",
  link: "M8 12l4-4M6.5 9.5l-1.6 1.6a2.8 2.8 0 004 4L10.5 13.5M9.5 6.5l1.6-1.6a2.8 2.8 0 014 4L13.5 10.5",
  gear: "M10 12.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2zM10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5",
  user: "M10 10.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5",
};

export function Icon({ d, size = 19 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function MoiRow({ href, icon, color, title, sub, badge }: { href: string; icon: string; color: string; title: string; sub: string; badge?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-t border-paper-dim px-3.5 py-3 first:border-t-0 hover:bg-[#f7f8f8]">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-paper-dim" style={{ color }}>
        <Icon d={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[15px] font-semibold text-ink">{title}</b>
        <span className="truncate text-[12.5px] text-slate">{sub}</span>
      </span>
      {badge && <span className="flex-shrink-0 text-xs font-bold text-[#a4492a]">{badge}</span>}
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#5b6660" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
        <path d="M8 5l5 5-5 5" />
      </svg>
    </Link>
  );
}

export function MoiGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1.5 text-xs font-bold uppercase tracking-[0.06em] text-slate">{label}</span>
      <div className="flex flex-col overflow-hidden rounded-2xl bg-white">{children}</div>
    </div>
  );
}
