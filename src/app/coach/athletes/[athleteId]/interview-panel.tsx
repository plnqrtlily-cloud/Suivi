"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { saveInterviewNoteAction } from "@/lib/actions";
import { Panel } from "./tab-ui";

// Note d'entretien : un document libre, comme une note Apple — titres,
// gras/italique/souligné/barré, surlignage, listes, cases à cocher, citations,
// tableaux, alignement, liens, annuler/rétablir — enregistré tout seul pendant
// la saisie. Visible du coach seulement.

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function savedLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? `Enregistré à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : `Modifié le ${d.getDate()} ${MS[d.getMonth()]} ${d.getFullYear()}`;
}

function Btn({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      // Garde la sélection dans le texte pendant le clic.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 min-w-9 flex-shrink-0 items-center justify-center rounded-lg px-1.5 text-[14px] transition-colors disabled:opacity-30 ${
        on ? "bg-[#1b4b4f] text-white" : "text-ink hover:bg-paper-dim"
      }`}
    >
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-6 w-px flex-shrink-0 bg-line" />;
const I = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Toolbar({ editor }: { editor: Editor }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      mark: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      table: e.isActive("table"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Adresse du lien", prev || "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-3 py-1.5 backdrop-blur sm:-mx-6">
      <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Btn label="Annuler" onClick={() => c().undo().run()} disabled={!st.undo}>
          <I d="M7 8H13a4 4 0 010 8H9M7 8l3-3M7 8l3 3" />
        </Btn>
        <Btn label="Rétablir" onClick={() => c().redo().run()} disabled={!st.redo}>
          <I d="M13 8H7a4 4 0 000 8h4M13 8l-3-3M13 8l-3 3" />
        </Btn>
        <Sep />
        <Btn label="Titre" on={st.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>
          <b className="text-[15px]">Titre</b>
        </Btn>
        <Btn label="Sous-titre" on={st.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
          <b className="text-[13px]">Sous-titre</b>
        </Btn>
        <Btn label="Intertitre" on={st.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
          <b className="text-[12px]">Intertitre</b>
        </Btn>
        <Btn label="Texte" on={!st.h1 && !st.h2 && !st.h3} onClick={() => c().setParagraph().run()}>
          <span className="text-[13px]">Texte</span>
        </Btn>
        <Sep />
        <Btn label="Gras" on={st.bold} onClick={() => c().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn label="Italique" on={st.italic} onClick={() => c().toggleItalic().run()}>
          <i className="font-serif">I</i>
        </Btn>
        <Btn label="Souligné" on={st.underline} onClick={() => c().toggleUnderline().run()}>
          <u>U</u>
        </Btn>
        <Btn label="Barré" on={st.strike} onClick={() => c().toggleStrike().run()}>
          <s>S</s>
        </Btn>
        <Btn label="Surligner" on={st.mark} onClick={() => c().toggleHighlight().run()}>
          <span className="rounded-sm bg-[#fde68a] px-1 text-[13px] font-semibold text-ink">A</span>
        </Btn>
        <Btn label="Lien" on={st.link} onClick={setLink}>
          <I d="M8 12l4-4M6.5 9.5l-1.6 1.6a2.8 2.8 0 004 4L10.5 13.5M9.5 6.5l1.6-1.6a2.8 2.8 0 014 4L13.5 10.5" />
        </Btn>
        <Sep />
        <Btn label="Liste à puces" on={st.bullet} onClick={() => c().toggleBulletList().run()}>
          <I d="M8 5.5h8M8 10h8M8 14.5h8M4 5.5h.01M4 10h.01M4 14.5h.01" />
        </Btn>
        <Btn label="Liste numérotée" on={st.ordered} onClick={() => c().toggleOrderedList().run()}>
          <I d="M8.5 5.5h8M8.5 10h8M8.5 14.5h8M3.5 4.5l1-.5v3M3.3 9.2a1 1 0 011.7.7c0 .8-1.7 1.5-1.7 2.1h1.8M3.4 13.5h1.5l-.8 1 .1 0a.8.8 0 11-.9 1.2" />
        </Btn>
        <Btn label="Cases à cocher" on={st.task} onClick={() => c().toggleTaskList().run()}>
          <I d="M3.5 4.5h4v4h-4zM4.5 6.5l1 1 1.5-2M10 6.5h6.5M3.5 11.5h4v4h-4zM10 13.5h6.5" />
        </Btn>
        <Btn label="Citation" on={st.quote} onClick={() => c().toggleBlockquote().run()}>
          <I d="M5 6v8M9 7h7M9 10h7M9 13h5" />
        </Btn>
        <Btn label="Séparateur" onClick={() => c().setHorizontalRule().run()}>
          <I d="M3 10h14" />
        </Btn>
        <Sep />
        <Btn label="Aligner à gauche" on={st.left} onClick={() => c().setTextAlign("left").run()}>
          <I d="M3 5h14M3 8.5h9M3 12h14M3 15.5h9" />
        </Btn>
        <Btn label="Centrer" on={st.center} onClick={() => c().setTextAlign("center").run()}>
          <I d="M3 5h14M5.5 8.5h9M3 12h14M5.5 15.5h9" />
        </Btn>
        <Btn label="Aligner à droite" on={st.right} onClick={() => c().setTextAlign("right").run()}>
          <I d="M3 5h14M8 8.5h9M3 12h14M8 15.5h9" />
        </Btn>
        <Btn label="Justifier" on={st.justify} onClick={() => c().setTextAlign("justify").run()}>
          <I d="M3 5h14M3 8.5h14M3 12h14M3 15.5h14" />
        </Btn>
        <Sep />
        {!st.table ? (
          <Btn label="Insérer un tableau" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <I d="M3 4h14v12H3zM3 8h14M3 12h14M8 4v12M12.5 4v12" />
          </Btn>
        ) : (
          <>
            <Btn label="Ajouter une ligne" onClick={() => c().addRowAfter().run()}>
              <span className="text-[12px] font-semibold">+ ligne</span>
            </Btn>
            <Btn label="Ajouter une colonne" onClick={() => c().addColumnAfter().run()}>
              <span className="text-[12px] font-semibold">+ colonne</span>
            </Btn>
            <Btn label="Supprimer la ligne" onClick={() => c().deleteRow().run()}>
              <span className="text-[12px] font-semibold">− ligne</span>
            </Btn>
            <Btn label="Supprimer la colonne" onClick={() => c().deleteColumn().run()}>
              <span className="text-[12px] font-semibold">− colonne</span>
            </Btn>
            <Btn label="Supprimer le tableau" onClick={() => c().deleteTable().run()}>
              <span className="text-[12px] font-semibold text-[#a4492a]">Suppr. tableau</span>
            </Btn>
          </>
        )}
        <Sep />
        <Btn label="Effacer la mise en forme" onClick={() => c().unsetAllMarks().clearNodes().run()}>
          <I d="M5 15l7-10M9 5h6M4 16h7M13 12l4 4M17 12l-4 4" />
        </Btn>
      </div>
    </div>
  );
}

export function InterviewPanel({
  athleteId,
  firstName,
  initialHtml,
  updatedAt,
}: {
  athleteId: string;
  firstName: string;
  initialHtml: string;
  updatedAt: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingHtml = useRef<string | null>(null);

  async function flush() {
    const html = pendingHtml.current;
    if (html === null) return;
    pendingHtml.current = null;
    setStatus("saving");
    try {
      const r = await saveInterviewNoteAction(athleteId, html);
      setSavedAt(r.savedAt);
      setStatus(pendingHtml.current === null ? "saved" : "saving");
    } catch {
      pendingHtml.current = pendingHtml.current ?? html;
      setStatus("error");
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: `Note de l'entretien avec ${firstName}…` }),
    ],
    content: initialHtml,
    editorProps: { attributes: { class: "note-editor min-h-[320px] outline-none" } },
    onUpdate: ({ editor: e }) => {
      pendingHtml.current = e.isEmpty ? "" : e.getHTML();
      setStatus("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
    },
  });

  // Rien de perdu en quittant la page ou l'onglet pendant un enregistrement.
  useEffect(() => {
    const onHide = () => {
      if (pendingHtml.current !== null) {
        clearTimeout(timer.current);
        void flush();
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      onHide();
    };
    // flush ne dépend que de refs et de l'athlète.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel className="flex flex-col">
      <div className="mb-2 flex items-baseline gap-3">
        <h3 className="text-[17px] font-bold tracking-tight text-ink">Entretien</h3>
        <span className="text-[13px] text-slate">
          {status === "saving" ? "Enregistrement…" : status === "error" ? <span className="text-[#a4492a]">Non enregistré, nouvel essai à la prochaine frappe</span> : savedLabel(savedAt) || "Visible de toi seul"}
        </span>
      </div>
      {editor ? <Toolbar editor={editor} /> : <div className="h-12" />}
      <div className="pt-3">
        <EditorContent editor={editor} />
      </div>
    </Panel>
  );
}
