"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/lib/actions";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export interface MessageItem {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  first_name: string;
}

export function ConversationThread({
  coachId,
  athleteId,
  currentUserId,
  messages,
  otherPartyName,
  otherPartyAvatarUserId,
  otherPartyHasAvatar,
}: {
  coachId: string;
  athleteId: string;
  currentUserId: string;
  messages: MessageItem[];
  otherPartyName: string;
  otherPartyAvatarUserId: string;
  otherPartyHasAvatar: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, []);

  // Rafraîchissement léger pour donner une impression de discussion vivante, sans
  // aller jusqu'à un vrai temps réel (websockets) hors de portée de ce prototype.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(interval);
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = String(formData.get("body") || "").trim();
    if (!body) return;
    setPending(true);
    formData.set("coachId", coachId);
    formData.set("athleteId", athleteId);
    await sendMessageAction(formData);
    setPending(false);
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-md border border-line bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate">
            Aucun message pour l&apos;instant — écrivez à {otherPartyName} ci-dessous.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            const isMine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                {!isMine && <Avatar userId={otherPartyAvatarUserId} firstName={otherPartyName} hasAvatar={otherPartyHasAvatar} size="sm" />}
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isMine ? "bg-moss text-white" : "bg-paper-dim text-ink"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-slate"}`}>
                    {m.created_at.slice(11, 16)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line p-3">
        <input
          name="body"
          placeholder="Écrire un message…"
          autoComplete="off"
          className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
        />
        <Button type="submit" disabled={pending}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
