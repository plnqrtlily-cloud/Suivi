"use client";

import { useMemo, useRef, useState } from "react";
import { alpha, byTitle, matchesSearch } from "@/lib/search-text";
import type { LibraryResource } from "./strength-builder";

// Recherche dans la bibliothèque depuis le constructeur de séance :
//  - ExerciseSearchField : le nom de l'exercice, avec en tête les exercices de
//    la bibliothèque (choisir l'un d'eux joint aussi sa démonstration), puis
//    les exercices habituels ; la saisie libre reste possible.
//  - ResourceSearchField : la démonstration jointe, à retrouver en tapant.
// Listes rangées par ordre alphabétique, accents et majuscules ignorés.

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss";

function Icon({ type }: { type: string }) {
  return <span className="w-5 flex-shrink-0 text-center text-[13px]">{type === "video" ? "🎬" : "🖼"}</span>;
}

type Option = { key: string; label: string; resource?: LibraryResource; section: string };

function Dropdown({
  options,
  active,
  onPick,
  empty,
}: {
  options: Option[];
  active: number;
  onPick: (o: Option) => void;
  empty: string;
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-[0_10px_28px_rgba(24,34,32,0.16)]">
      {options.length === 0 && <p className="px-3 py-2 text-[13px] text-slate">{empty}</p>}
      {options.map((o, i) => {
        const head = o.section && (i === 0 || options[i - 1].section !== o.section) ? o.section : null;
        return (
          <div key={o.key}>
            {head && <p className="px-3 pb-0.5 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-slate">{head}</p>}
            <button
              type="button"
              // mousedown : choisi avant que le champ ne perde le focus et ne referme la liste.
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(o);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? "bg-[#e3eeed]" : "hover:bg-paper"}`}
            >
              {o.resource ? <Icon type={o.resource.type} /> : <span className="w-5 flex-shrink-0" />}
              <span className="truncate text-ink">{o.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function useCombo(options: Option[], onPick: (o: Option) => void) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      onPick(options[active]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return { open, setOpen, active, setActive, onKeyDown };
}

export function ExerciseSearchField({
  value,
  library,
  suggestions,
  onChange,
}: {
  value: string;
  library: LibraryResource[];
  suggestions: string[];
  /** Nom saisi ou choisi ; `resource` quand c'est un exercice de la bibliothèque. */
  onChange: (name: string, resource?: LibraryResource) => void;
}) {
  const sortedLib = useMemo(() => [...library].sort(byTitle), [library]);
  const sortedSug = useMemo(() => [...new Set(suggestions)].sort(alpha), [suggestions]);
  const options: Option[] = [
    ...sortedLib.filter((r) => matchesSearch(value, r.title)).map((r) => ({ key: `r-${r.id}`, label: r.title, resource: r, section: "Ma bibliothèque" })),
    ...sortedSug
      .filter((n) => matchesSearch(value, n) && !sortedLib.some((r) => r.title === n))
      .slice(0, 30)
      .map((n) => ({ key: `s-${n}`, label: n, section: "Exercices courants" })),
  ];
  const pick = (o: Option) => onChange(o.label, o.resource);
  const c = useCombo(options, pick);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          c.setOpen(true);
          c.setActive(0);
        }}
        onFocus={() => c.setOpen(true)}
        onBlur={() => c.setOpen(false)}
        onKeyDown={c.onKeyDown}
        placeholder="Rechercher ou saisir…"
        className={inputCls}
      />
      {c.open && <Dropdown options={options} active={c.active} onPick={(o) => (pick(o), c.setOpen(false))} empty="Aucun exercice trouvé : le nom saisi sera utilisé tel quel." />}
    </div>
  );
}

export function ResourceSearchField({
  value,
  library,
  onChange,
}: {
  value: string;
  library: LibraryResource[];
  onChange: (resourceId: string) => void;
}) {
  const current = library.find((r) => r.id === value) ?? null;
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sorted = useMemo(() => [...library].sort(byTitle), [library]);
  const options: Option[] = [
    ...(current ? [{ key: "none", label: "Aucune démonstration", section: "" }] : []),
    ...sorted.filter((r) => matchesSearch(q, r.title)).map((r) => ({ key: r.id, label: r.title, resource: r, section: "Ma bibliothèque" })),
  ];
  const pick = (o: Option) => {
    onChange(o.key === "none" ? "" : o.key);
    setQ("");
    setEditing(false);
  };
  const c = useCombo(options, pick);
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink-soft">Démonstration (bibliothèque)</span>
      <div className="relative">
        <input
          ref={inputRef}
          value={editing ? q : current ? `${current.type === "video" ? "🎬" : "🖼"} ${current.title}` : ""}
          onChange={(e) => {
            setQ(e.target.value);
            c.setActive(0);
            c.setOpen(true);
          }}
          onFocus={() => {
            setEditing(true);
            c.setOpen(true);
          }}
          onBlur={() => {
            setEditing(false);
            setQ("");
            c.setOpen(false);
          }}
          onKeyDown={c.onKeyDown}
          placeholder={library.length ? "Aucune — tapez pour chercher" : "Bibliothèque vide"}
          className={inputCls}
        />
        {c.open && <Dropdown options={options} active={c.active} onPick={(o) => (pick(o), inputRef.current?.blur())} empty="Aucune ressource ne correspond." />}
      </div>
    </label>
  );
}
