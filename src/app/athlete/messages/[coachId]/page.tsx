import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getMessages, getUserAvatar } from "@/lib/queries";
import { markMessagesReadAction } from "@/lib/actions";
import { Nav } from "@/components/nav";
import { ConversationThread } from "@/components/conversation-thread";

export default async function AthleteMessagesPage({ params }: { params: Promise<{ coachId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const { coachId } = await params;
  const [linked, coach, coachAvatar] = await Promise.all([isCoachLinkedToAthlete(coachId, user.id), findUserById(coachId), getUserAvatar(coachId)]);
  if (!linked || !coach) notFound();

  const [messages] = await Promise.all([getMessages(coachId, user.id), markMessagesReadAction(coachId, user.id)]);

  // Discussion plein écran, comme Messages : pas de titre au-dessus, la
  // conversation prend toute la place entre la barre du haut et celle du bas.
  return (
    <div className="min-h-screen bg-white">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl">
        <ConversationThread
          coachId={coachId}
          athleteId={user.id}
          currentUserId={user.id}
          messages={messages}
          otherPartyName={coach.first_name}
          otherPartyAvatarUserId={coachId}
          otherPartyHasAvatar={!!coachAvatar?.avatar_path}
          fullScreen
          backHref="/athlete/messages"
        />
      </main>
    </div>
  );
}
