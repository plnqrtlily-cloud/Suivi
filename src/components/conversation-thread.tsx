"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/lib/actions";
import { Avatar } from "@/components/avatar";

export interface MessageItem {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  first_name: string;
  media_path?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  read_at?: string | null;
}

export function ConversationThread({
  coachId,
  athleteId,
  currentUserId,
  messages,
  otherPartyName,
  otherPartyAvatarUserId,
  otherPartyHasAvatar,
  profileHref,
}: {
  coachId: string;
  athleteId: string;
  currentUserId: string;
  messages: MessageItem[];
  otherPartyName: string;
  otherPartyAvatarUserId: string;
  otherPartyHasAvatar: boolean;
  profileHref?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Rafraîchissement fréquent pour une impression de discussion en direct, sans
  // aller jusqu'à un vrai push temps réel (websockets, hors de portée de ce
  // prototype sur une plateforme serverless). Coupé quand l'onglet n'est pas
  // visible pour ne pas enchaîner les requêtes inutilement en arrière-plan.
  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible") router.refresh();
    }
    const interval = setInterval(tick, 3000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  // Envoi optimiste : la bulle apparaît tout de suite, comme dans Messages.
  const [sent, setSent] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ file: File; preview: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const shown = [...messages, ...sent.filter((t) => !messages.some((m) => m.sender_id === t.sender_id && m.body === t.body && m.created_at >= t.created_at.slice(0, 16)))];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [shown.length]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      preview: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : null,
    }));
    setFiles((f) => [...f, ...next].slice(0, 10));
    setError(null);
  }

  function removeFile(i: number) {
    setFiles((f) => {
      const p = f[i]?.preview;
      if (p) URL.revokeObjectURL(p);
      return f.filter((_, j) => j !== i);
    });
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const body = text.trim();
    // Une pièce jointe seule suffit — pas besoin de texte.
    if (pending || (!body && files.length === 0)) return;
    setPending(true);
    setError(null);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (body) setSent((l) => [...l, { id: `tmp-${Date.now()}`, sender_id: currentUserId, body, created_at: now, first_name: "" }]);
    const toSend = files;
    setText("");
    setFiles([]);
    if (textRef.current) textRef.current.style.height = "auto";
    // Comme dans Messages : chaque pièce jointe devient sa propre bulle, le texte part en dernier.
    const payloads: FormData[] = toSend.map(({ file }) => {
      const fd = new FormData();
      fd.set("media", file);
      return fd;
    });
    if (body) {
      const fd = new FormData();
      fd.set("body", body);
      payloads.push(fd);
    }
    const failed: string[] = [];
    for (const fd of payloads) {
      fd.set("coachId", coachId);
      fd.set("athleteId", athleteId);
      try {
        await sendMessageAction(fd);
      } catch (err) {
        const f = fd.get("media");
        failed.push(f instanceof File ? `${f.name} : ${err instanceof Error ? err.message : "échec de l’envoi"}` : "Message non envoyé.");
      }
    }
    toSend.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    if (failed.length) setError(failed.join(" · "));
    setPending(false);
    router.refresh();
  }

  const lastMine = [...shown].reverse().find((m) => m.sender_id === currentUserId);

  return (
    <div className="flex h-[72vh] flex-col overflow-hidden rounded-3xl border border-line bg-white">
      <div className="flex flex-col items-center gap-1 border-b border-[#e5e5ea] bg-[#f9f9f9] px-4 pb-2 pt-3">
        <Avatar userId={otherPartyAvatarUserId} firstName={otherPartyName} hasAvatar={otherPartyHasAvatar} size="md" />
        <span className="flex items-center gap-0.5 text-[12px] text-ink">
          {otherPartyName}
          {profileHref && (
            <a href={profileHref} className="text-slate hover:text-ink" aria-label="Accéder au profil">
              ›
            </a>
          )}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {shown.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate">Aucun message pour l&apos;instant. Écrivez à {otherPartyName} ci-dessous.</p>
        )}
        <div className="flex flex-col">
          {shown.map((m, i) => {
            const isMine = m.sender_id === currentUserId;
            const prev = shown[i - 1];
            const next = shown[i + 1];
            const t = stamp(m.created_at);
            const showTime = !prev || t - stamp(prev.created_at) > 60 * 60 * 1000 || dayKey(prev.created_at) !== dayKey(m.created_at);
            const samePrev = !!prev && prev.sender_id === m.sender_id && !showTime && t - stamp(prev.created_at) < 5 * 60 * 1000;
            const nextShowsTime = !!next && (stamp(next.created_at) - t > 60 * 60 * 1000 || dayKey(next.created_at) !== dayKey(m.created_at));
            const sameNext = !!next && next.sender_id === m.sender_id && !nextShowsTime && stamp(next.created_at) - t < 5 * 60 * 1000;
            const tail = !sameNext;
            const media = !!m.media_path && m.media_type !== "document";
            const jumbo = !m.media_path && isJumboEmoji(m.body);
            const tmp = m.id.startsWith("tmp-");
            const label = showTime ? timeLabel(m.created_at) : null;
            return (
              <div key={m.id} className={tmp ? "imsg-in" : ""}>
                {label && (
                  <p className={`mb-2 text-center text-[11px] text-slate ${i === 0 ? "" : "mt-5"}`}>
                    <span className="font-semibold">{label[0]}</span> {label[1]}
                  </p>
                )}
                <div className={`flex ${isMine ? "justify-end" : "justify-start"} ${samePrev ? "mt-[2px]" : "mt-2"} ${isMine ? "pr-1.5" : "pl-1.5"}`}>
                  {jumbo ? (
                    <p title={m.created_at.slice(11, 16)} className="px-1 text-[44px] leading-tight">
                      {m.body}
                    </p>
                  ) : media && !m.body ? (
                    <MediaBlock m={m} className="w-64 max-w-[70%] rounded-[18px]" />
                  ) : (
                    <div
                      title={m.created_at.slice(11, 16)}
                      className={`imsg ${isMine ? "imsg-me" : "imsg-them"} ${tail && !media ? "imsg-tail" : ""} ${tmp ? "opacity-80" : ""}`}
                    >
                      {media && <MediaBlock m={m} className="-mx-3 -mt-[7px] mb-1.5 rounded-t-[18px]" />}
                      {m.media_path && m.media_type === "document" && (
                        <a
                          href={`/api/messages/${m.id}/media`}
                          download={m.media_name ?? undefined}
                          className={`-mx-0.5 flex items-center gap-3 py-0.5 ${m.body ? "mb-1.5" : ""}`}
                        >
                          <span
                            className={`flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                              isMine ? "bg-white/25 text-white" : "bg-white text-[#0a84ff]"
                            }`}
                          >
                            {fileExt(m.media_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium">{m.media_name || "Document"}</span>
                            <span className={`block text-[12px] ${isMine ? "text-white/75" : "text-slate"}`}>Télécharger</span>
                          </span>
                        </a>
                      )}
                      {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                    </div>
                  )}
                </div>
                {isMine && lastMine?.id === m.id && (
                  <p className="mt-1 pr-1.5 text-right text-[11px] text-slate">
                    {tmp ? "Envoi…" : m.read_at ? <><span className="font-semibold">Lu</span> {readLabel(m.read_at)}</> : <span className="font-semibold">Distribué</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 px-3 pb-3 pt-2">
        {error && <p className="px-1 text-xs text-clay">{error}</p>}
        <div className="flex items-end gap-2">
          <label
            className="mb-px flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#e9e9eb] text-xl leading-none text-[#6e6e73] transition-colors hover:bg-[#dcdce0]"
            title="Joindre des photos, vidéos ou documents"
          >
            +
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex min-w-0 flex-1 flex-col rounded-[18px] border border-[#d1d1d6] bg-white">
            {files.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-2 pt-2">
                {files.map((f, i) => (
                  <div key={i} className="relative shrink-0 animate-expand-in">
                    {f.preview && f.file.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt={f.file.name} className="h-16 w-16 rounded-xl object-cover" />
                    ) : f.preview ? (
                      <video src={f.preview} muted className="h-16 w-16 rounded-xl bg-ink object-cover" />
                    ) : (
                      <div className="flex h-16 w-36 items-center gap-2 rounded-xl bg-paper-dim px-2">
                        <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[9px] font-bold text-moss-dark">
                          {fileExt(f.file.name)}
                        </span>
                        <span className="line-clamp-2 break-all text-[11px] leading-tight text-ink">{f.file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Retirer ${f.file.name}`}
                      onClick={() => removeFile(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs leading-none text-white hover:bg-ink"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex min-h-[34px] items-end pl-3.5 pr-1">
              <textarea
                ref={textRef}
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files.length) {
                    e.preventDefault();
                    addFiles(e.clipboardData.files);
                  }
                }}
                placeholder="Message"
                className="block min-w-0 flex-1 resize-none bg-transparent py-[6px] text-[15.5px] text-ink !outline-none placeholder:text-[#8e8e93]"
              />
              {(text.trim() || files.length > 0) && (
                <button
                  type="submit"
                  disabled={pending}
                  aria-label="Envoyer"
                  className="imsg-in mb-[3px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a84ff] text-white transition-opacity disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function MediaBlock({ m, className }: { m: MessageItem; className: string }) {
  const src = `/api/messages/${m.id}/media`;
  return (
    <div className={`overflow-hidden ${className}`}>
      {m.media_type === "video" ? (
        <video controls playsInline preload="metadata" className="block max-h-80 w-full bg-ink">
          <source src={src} />
        </video>
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Photo" className="block max-h-80 w-full object-cover" />
        </a>
      )}
    </div>
  );
}

// Comme dans Messages : jusqu'à trois émojis seuls s'affichent en grand, sans bulle.
function isJumboEmoji(body: string) {
  const t = body.trim();
  if (!t || t.length > 24 || !/^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]+$/u.test(t)) return false;
  const n = [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(t.replace(/\s/g, ""))].length;
  return n >= 1 && n <= 3 && !/^[0-9#*]+$/.test(t);
}

function readLabel(iso: string) {
  const d = toDate(iso);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? hm : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const ACCEPT = "image/*,video/*,.pdf,.docx,.xlsx,.pptx,.txt,.csv";

function fileExt(name?: string | null) {
  const i = name?.lastIndexOf(".") ?? -1;
  return i > 0 ? name!.slice(i + 1, i + 5).toUpperCase() : "DOC";
}

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const DAYS_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// Les dates en base sont en UTC (« YYYY-MM-DD HH:MM:SS »).
function toDate(iso: string) {
  return new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
}
function stamp(iso: string) {
  return toDate(iso).getTime();
}
function dayKey(iso: string) {
  return toDate(iso).toDateString();
}
function timeLabel(iso: string): [string, string] {
  const d = toDate(iso);
  const now = new Date();
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return ["Aujourd’hui", hm];
  if (days === 1) return ["Hier", hm];
  if (days < 7) return [DAYS_LONG[d.getDay()], hm];
  return [`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`, `à ${hm}`];
}
