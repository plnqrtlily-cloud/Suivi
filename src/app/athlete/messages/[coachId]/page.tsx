import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import { getMessages, getUserAvatar } from "@/lib/queries";
import { markMessagesReadAction } from "@/lib/actions";
import { Nav } from "@/components/nav";
import { ConversationThread } from "@/components/conversation-thread";

export default async function AthleteMessagesPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { coachId } = await params;
  if (!(await isCoachLinkedToAthlete(coachId, user.id))) notFound();
  const coach = await findUserById(coachId);
  if (!coach) notFound();

  const messages = await getMessages(coachId, user.id);
  await markMessagesReadAction(coachId, user.id);

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">
          Discussion avec {coach.first_name} {coach.last_name}
        </h1>
        <p className="mb-6 text-slate">Message direct à votre coach.</p>
        <ConversationThread
          coachId={coachId}
          athleteId={user.id}
          currentUserId={user.id}
          messages={messages}
          otherPartyName={coach.first_name}
          otherPartyAvatarUserId={coachId}
          otherPartyHasAvatar={false}
        />
      </main>
    </div>
  );
}
