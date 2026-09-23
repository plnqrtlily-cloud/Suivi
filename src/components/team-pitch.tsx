import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { TEAM_SPORTS, layoutBand, type TeamSport } from "@/lib/team-sports";

// Terrain dessiné en SVG pur (pas de dépendance externe), même convention à
// viewBox fixe que cycle-wheel.tsx/readiness-gauge.tsx — seul le tracé des
// marquages change d'un sport à l'autre. Sens d'attaque toujours de gauche
// (but/panier propre) à droite.
const FIELD = { x: 10, y: 10, w: 280, h: 180 };
const LINE_COLOR = "#1B4B4F"; // --color-moss

function FootballMarkings() {
  return (
    <g stroke={LINE_COLOR} strokeWidth={1.5} fill="none">
      <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} />
      <line x1={150} y1={10} x2={150} y2={190} strokeOpacity={0.55} />
      <circle cx={150} cy={100} r={25} strokeOpacity={0.55} />
      <circle cx={150} cy={100} r={1.5} fill={LINE_COLOR} stroke="none" />
      <rect x={10} y={55} width={45} height={90} strokeOpacity={0.55} />
      <rect x={10} y={75} width={18} height={50} strokeOpacity={0.55} />
      <rect x={245} y={55} width={45} height={90} strokeOpacity={0.55} />
      <rect x={272} y={75} width={18} height={50} strokeOpacity={0.55} />
      <circle cx={35} cy={100} r={1.2} fill={LINE_COLOR} stroke="none" />
      <circle cx={265} cy={100} r={1.2} fill={LINE_COLOR} stroke="none" />
    </g>
  );
}

function RugbyMarkings() {
  return (
    <g stroke={LINE_COLOR} strokeWidth={1.5} fill="none">
      <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} />
      <line x1={150} y1={10} x2={150} y2={190} strokeOpacity={0.55} />
      <circle cx={150} cy={100} r={10} strokeOpacity={0.4} strokeDasharray="3 2" />
      <line x1={30} y1={10} x2={30} y2={190} strokeOpacity={0.55} />
      <line x1={270} y1={10} x2={270} y2={190} strokeOpacity={0.55} />
      <line x1={75} y1={10} x2={75} y2={190} strokeOpacity={0.35} strokeDasharray="4 3" />
      <line x1={225} y1={10} x2={225} y2={190} strokeOpacity={0.35} strokeDasharray="4 3" />
    </g>
  );
}

function HandballMarkings() {
  return (
    <g stroke={LINE_COLOR} strokeWidth={1.5} fill="none">
      <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} />
      <line x1={150} y1={10} x2={150} y2={190} strokeOpacity={0.55} />
      <path d="M10 65 Q 55 100 10 135" strokeOpacity={0.55} />
      <path d="M290 65 Q 245 100 290 135" strokeOpacity={0.55} />
      <path d="M10 40 Q 90 100 10 160" strokeOpacity={0.3} strokeDasharray="4 3" />
      <path d="M290 40 Q 210 100 290 160" strokeOpacity={0.3} strokeDasharray="4 3" />
      <rect x={6} y={90} width={4} height={20} strokeOpacity={0.7} />
      <rect x={290} y={90} width={4} height={20} strokeOpacity={0.7} />
    </g>
  );
}

function BasketballMarkings() {
  return (
    <g stroke={LINE_COLOR} strokeWidth={1.5} fill="none">
      <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} />
      <line x1={150} y1={10} x2={150} y2={190} strokeOpacity={0.55} />
      <circle cx={150} cy={100} r={18} strokeOpacity={0.55} />
      <rect x={10} y={70} width={55} height={60} strokeOpacity={0.55} />
      <rect x={235} y={70} width={55} height={60} strokeOpacity={0.55} />
      <circle cx={65} cy={100} r={18} strokeOpacity={0.4} />
      <circle cx={235} cy={100} r={18} strokeOpacity={0.4} />
      <path d="M10 30 Q 100 100 10 170" strokeOpacity={0.35} />
      <path d="M290 30 Q 200 100 290 170" strokeOpacity={0.35} />
      <circle cx={18} cy={100} r={2} fill={LINE_COLOR} stroke="none" />
      <circle cx={282} cy={100} r={2} fill={LINE_COLOR} stroke="none" />
    </g>
  );
}

const MARKINGS: Record<TeamSport, () => React.ReactElement> = {
  football: FootballMarkings,
  rugby: RugbyMarkings,
  handball: HandballMarkings,
  basketball: BasketballMarkings,
};

export interface TeamPitchMember {
  athleteId: string;
  firstName: string;
  avatarPath: string | null;
  position: string;
}

export function TeamPitch({ sport, members }: { sport: TeamSport; members: TeamPitchMember[] }) {
  const Markings = MARKINGS[sport];
  const byPosition = new Map<string, TeamPitchMember[]>();
  for (const m of members) {
    if (!byPosition.has(m.position)) byPosition.set(m.position, []);
    byPosition.get(m.position)!.push(m);
  }
  const placed = TEAM_SPORTS[sport].positions.flatMap((pos) => {
    const group = byPosition.get(pos.value) ?? [];
    return layoutBand(pos.band, group.length).map((coords, i) => ({ ...coords, member: group[i] }));
  });

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-line bg-[#E6EAE9]">
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full">
        <Markings />
      </svg>
      {placed.map(({ xPct, yPct, member }) => (
        <Link
          key={member.athleteId}
          href={`/coach/athletes/${member.athleteId}`}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
          style={{ left: `${xPct}%`, top: `${yPct}%` }}
        >
          <Avatar userId={member.athleteId} firstName={member.firstName} hasAvatar={!!member.avatarPath} size="sm" />
          <span className="rounded bg-white/85 px-1 text-[10px] font-medium leading-tight text-ink shadow-sm">
            {member.firstName}
          </span>
        </Link>
      ))}
    </div>
  );
}
