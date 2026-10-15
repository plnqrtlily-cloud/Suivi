import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isCoachLinkedToAthlete } from "@/lib/auth";
import { dbGet, dbRun } from "@/lib/db";
import { getHealthMessages, getHealthReport, getPainHistory, HEALTH_CATEGORY_LABEL, TRAINING_IMPACT_LABEL } from "@/lib/health";
import { getCoachesForAthlete } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { HealthThreadActions, HealthComposer } from "./health-thread-client";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function longDay(iso: string, today: string) {
  if (iso === today) return "Aujourd'hui";
  const d = new Date(`${iso}T00:00:00`);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`.replace(/^./, (c) => c.toUpperCase());
}
function shortDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
}
// Les horodatages SQLite sont en UTC ("YYYY-MM-DD HH:MM:SS") : affichés à
// l'heure de Paris, celle des utilisateurs de Rythme.
function localParts(ts: string) {
  const d = new Date(`${ts.replace(" ", "T")}Z`);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

export default async function HealthThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const report = await getHealthReport(id);
  if (!report) notFound();
  const isAthlete = user.role === "athlete";
  if (isAthlete ? report.athlete_id !== user.id : !(await isCoachLinkedToAthlete(user.id, report.athlete_id))) notFound();

  // Ouvrir le fil vaut lecture des messages de l'autre partie.
  await dbRun(`UPDATE health_messages SET read_at = datetime('now') WHERE injury_id = ? AND author_id != ? AND read_at IS NULL`, [id, user.id]);

  const [messages, pains, coaches, athlete] = await Promise.all([
    getHealthMessages(id),
    getPainHistory(id),
    isAthlete ? getCoachesForAthlete(user.id) : Promise.resolve([]),
    dbGet<{ first_name: string }>(`SELECT first_name FROM users WHERE id = ?`, [report.athlete_id]),
  ]);
  const today = todayISO();
  const ongoing = !report.date_end || report.date_end >= today;
  const healedToday = report.date_end != null && report.date_end <= today;
  const other = isAthlete ? coaches.map((c) => c.first_name).join(", ") || "ton coach" : athlete?.first_name ?? "l'athlète";
  const lastPains = pains.slice(-5);
  const sub = [
    report.description,
    report.category === "etat" && report.date_end ? `du ${shortDay(report.date_start)} au ${shortDay(report.date_end)}` : `depuis le ${shortDay(report.date_start)}`,
    report.doctor_seen != null ? (report.doctor_seen ? "médecin vu" : "pas de médecin") : null,
    report.training_impact ? TRAINING_IMPACT_LABEL[report.training_impact] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const parts = messages.map((m) => localParts(m.created_at));
  const items = messages.map((m, i) => ({
    m,
    time: parts[i].time,
    sep: i === 0 || parts[i].date !== parts[i - 1].date ? longDay(parts[i].date, today) : null,
  }));

  const backHref = isAthlete ? "/athlete" : `/coach/athletes/${report.athlete_id}?tab=sante`;
  const backLabel = isAthlete ? "Aujourd'hui" : `Santé de ${athlete?.first_name ?? "l'athlète"}`;

  const content = (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-2xl flex-col pb-24 lg:pb-6">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <Link href={backHref} className="flex items-center gap-1 text-[15px] font-semibold text-moss-dark">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5l-5 5 5 5" />
          </svg>
          {backLabel}
        </Link>
        <span className="text-[13px] text-slate">avec {other}</span>
      </div>

      <section className="mx-4 flex items-center gap-4 rounded-[18px] bg-white p-4">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ongoing ? "bg-[#fbe3da] text-[#a4492a]" : "bg-[#dfeceb] text-[#1b4b4f]"}`}
          >
            {HEALTH_CATEGORY_LABEL[report.category]} · {ongoing ? "en cours" : report.category === "etat" ? "terminé" : "guéri"}
          </span>
          <h1 className="text-[17px] font-bold leading-tight text-ink">{report.zone}</h1>
          {sub && <p className="text-[12.5px] text-slate">{sub}</p>}
        </div>
        {lastPains.length > 0 && (
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] text-slate">Douleur</span>
            <div className="flex items-end gap-1">
              {lastPains.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-bold text-ink">{p.pain}</span>
                  <div
                    className="w-4 rounded-[3px]"
                    style={{ height: `${4 + p.pain * 3}px`, background: i === lastPains.length - 1 ? "#e8896a" : "#e9c7b8" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {ongoing && !healedToday && (
        <HealthThreadActions injuryId={id} isAthlete={isAthlete} showPain={isAthlete && report.category === "blessure"} category={report.category} />
      )}

      <section className="mt-3 flex flex-1 flex-col gap-2 rounded-t-[22px] bg-white px-4 py-4">
        {items.map(({ m, time, sep }) => {
          const mine = m.author_id === user.id;
          return (
            <div key={m.id} className="flex flex-col gap-2">
              {sep && <span className="self-center pt-1 text-xs font-semibold text-slate">{sep}</span>}
              {m.kind === "message" ? (
                <div className={`flex max-w-[80%] flex-col gap-0.5 ${mine ? "self-end items-end" : "self-start items-start"}`}>
                  <div
                    className={`whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-[14.5px] leading-snug ${
                      mine ? "bg-[#0a84ff] text-white" : "bg-[#e9e9eb] text-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="px-1 text-[11px] text-slate">
                    {time}
                    {mine && m.read_at ? " · Lu" : ""}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 self-center rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#a4492a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0110 6.3a3.3 3.3 0 016 2c0 4.6-6 8.2-6 8.2z" />
                  </svg>
                  {m.body}
                  <span className="text-slate">· {time}</span>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-sm text-slate">Aucun échange pour l&apos;instant.</p>}
      </section>

      <HealthComposer injuryId={id} isAthlete={isAthlete} placeholder={`Message à ${other}`} />
    </div>
  );

  if (!isAthlete) {
    return (
      <div className="flex min-h-screen bg-paper">
        <CoachSidebar user={user} />
        <div className="min-w-0 flex-1">
          <div className="lg:hidden">
            <Nav user={user} />
          </div>
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      {content}
    </div>
  );
}
