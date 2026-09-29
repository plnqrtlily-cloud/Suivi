// Briques visuelles communes aux onglets de la fiche athlète, alignées sur le
// calendrier : titres forts sans capitales, cartes blanches sans bandeau,
// boutons discrets en contour. Aucun hook : utilisables côté serveur et client.

export const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-moss-dark transition-colors hover:bg-paper-dim disabled:opacity-50";
export const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-moss-dark disabled:opacity-50";
export const linkBtn = "text-[13px] font-semibold text-moss-dark hover:underline";
export const fieldClass =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-moss focus:bg-white";
export const fieldLabel = "mb-1 block text-xs font-medium text-slate";

export function TabHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-ink first-letter:uppercase">{title}</h2>
        {subtitle && <p className="text-sm text-slate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function PanelTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 className="text-[17px] font-bold tracking-tight text-ink">{title}</h3>
      {hint && <span className="text-[13px] text-slate">{hint}</span>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Row({ label, value, hint }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0">
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-baseline gap-2 text-right">
        <b className="font-semibold text-ink">{value}</b>
        {hint && <span className="text-xs text-slate">{hint}</span>}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-paper-dim p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
            value === o.value ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ouverture en fondu + glissement, comme les panneaux du calendrier. */
export function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
