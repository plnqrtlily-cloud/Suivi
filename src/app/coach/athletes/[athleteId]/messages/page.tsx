import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getMessages, getUserAvatar } from "@/lib/queries";
import { markMessagesReadAction } from "@/lib/actions";
import { Nav } from "@/components/nav";
import { ConversationThread } from "@/components/conversation-thread";

export default async function CoachMessagesPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId } = await params;
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) notFound();
  const athlete = await findUserById(athleteId);
  if (!athlete) notFound();

  const messages = await getMessages(user.id, athleteId);
  await markMessagesReadAction(user.id, athleteId);
  const athleteAvatar = await getUserAvatar(athleteId);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">
          Discussion avec {athlete.first_name} {athlete.last_name}
        </h1>
        <p className="mb-6 text-slate">Message direct, hors du fil d&apos;une séance précise.</p>
        <ConversationThread
          coachId={user.id}
          athleteId={athleteId}
          currentUserId={user.id}
          messages={messages}
          otherPartyName={athlete.first_name}
          otherPartyAvatarUserId={athleteId}
          otherPartyHasAvatar={!!athleteAvatar?.avatar_path}
        />
      </main>
    </div>
  );
}
