import type { InterestId } from '../../shared/interests';
import { campusDateKey, campusTimeToUtc } from '../../shared/time';
import type { CampusEvent, Database, Student } from '../../shared/types';

/**
 * Demo dataset. Every event here is SAMPLE DATA: plausible campus activities
 * with invented schedules, labeled as such in the UI. Dates are generated
 * relative to "now" so the demo always has upcoming events.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE_SOURCE = { type: 'sample', label: 'OwlMatch sample dataset', url: null, verifiedAt: null } as const;
const ONGOING_SPAN_DAYS = 60;

interface SampleEvent {
  id: string;
  title: string;
  description: string;
  categories: InterestId[];
  tags: string[];
  campus: CampusEvent['campus'];
  venue: string;
  address: string;
  dayOffset: number;
  start: string;
  end: string;
  groupSize: CampusEvent['groupSize'];
  energy: CampusEvent['energy'];
  beginnerFriendly: boolean;
  capacity: number | null;
  organizer: string;
  kind?: CampusEvent['kind'];
}

const SAMPLE_EVENTS: SampleEvent[] = [
  {
    id: 'evt-gamedev-101', title: 'Intro to Game Dev: Build a Platformer in 2 Hours',
    description: 'Never made a game? Pair up with another student and build a tiny platformer in Godot. Laptops required, no experience needed — mentors walk you through movement, jumping and one enemy. You leave with a playable game and a teammate.',
    categories: ['tech', 'gaming'], tags: ['godot', 'game jam', 'beginner', 'pair programming'],
    campus: 'marietta', venue: 'Engineering Technology Center', address: 'Engineering Technology Center, Room 120 (sample)',
    dayOffset: 1, start: '14:00', end: '16:00', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: 24, organizer: 'Game Dev Society (sample org)',
  },
  {
    id: 'evt-pickup-hoops', title: 'Pickup Basketball Night',
    description: 'Casual 5v5 runs, teams rotate every game so everyone plays. All skill levels; we keep it friendly and fast. Bring water and court shoes.',
    categories: ['sports', 'social'], tags: ['basketball', 'pickup', 'rec center'],
    campus: 'marietta', venue: 'Marietta Recreation Center', address: 'Marietta Recreation Center, Court 2 (sample)',
    dayOffset: 0, start: '19:00', end: '21:00', groupSize: 'medium', energy: 'high', beginnerFriendly: true, capacity: 30, organizer: 'Hoops Crew (sample student group)',
  },
  {
    id: 'evt-robotics-build', title: 'Robotics Club Build Session',
    description: 'Hands-on build night for our combat robot. Help with CAD, wiring the drive train, or programming the Arduino controller. Small team, lots of mentoring.',
    categories: ['engineering', 'tech', 'orgs'], tags: ['robotics', 'arduino', 'cad', 'hardware'],
    campus: 'marietta', venue: 'Q Building Makerspace', address: 'Q Building, Makerspace Lab (sample)',
    dayOffset: 4, start: '18:00', end: '20:30', groupSize: 'small', energy: 'relaxed', beginnerFriendly: false, capacity: 15, organizer: 'Robotics Club (sample org)',
  },
  {
    id: 'evt-valorant-scrims', title: 'Valorant Scrims & Tryouts',
    description: 'Competitive 5v5 scrims for the varsity-style esports roster. Ranked Gold+ recommended. Comms required, bring your own headset.',
    categories: ['gaming'], tags: ['esports', 'valorant', 'competitive', 'tryouts'],
    campus: 'marietta', venue: 'Student Center Game Room', address: 'Student Center Game Room (sample)',
    dayOffset: 2, start: '20:00', end: '23:00', groupSize: 'medium', energy: 'high', beginnerFriendly: false, capacity: 20, organizer: 'Esports Club (sample org)',
  },
  {
    id: 'evt-resume-review', title: 'Resume Review with Career Advisors',
    description: 'Drop in with a printed or digital resume and get 15 minutes of one-on-one feedback before internship season. Tech, engineering and business resumes welcome.',
    categories: ['career'], tags: ['resume', 'internship', 'career'],
    campus: 'marietta', venue: 'Atrium Building', address: 'Atrium Building, Room 200 (sample)',
    dayOffset: 3, start: '13:00', end: '15:00', groupSize: 'medium', energy: 'relaxed', beginnerFriendly: true, capacity: null, organizer: 'Career workshop (sample listing)',
  },
  {
    id: 'evt-sunset-volleyball', title: 'Sunset Volleyball on the Green',
    description: 'Grass volleyball as the sun goes down. Teams are mixed on arrival, so come solo — it is an easy way to meet people. Speaker, snacks and extra balls provided.',
    categories: ['sports', 'social', 'outdoors'], tags: ['volleyball', 'meet new people', 'outdoor'],
    campus: 'marietta', venue: 'Marietta Campus Green', address: 'Campus Green by the Student Center (sample)',
    dayOffset: 1, start: '17:00', end: '19:00', groupSize: 'medium', energy: 'high', beginnerFriendly: true, capacity: 40, organizer: 'Outdoor Rec (sample listing)',
  },
  {
    id: 'evt-anime-sketch', title: 'Anime & Sketch Night',
    description: 'Watch a couple of episodes, then draw your favorite characters together. Any skill level, paper and markers provided. Chill vibe, small group.',
    categories: ['arts', 'social'], tags: ['anime', 'drawing', 'sketch', 'chill'],
    campus: 'marietta', venue: 'Student Center Lounge', address: 'Student Center, Lounge B (sample)',
    dayOffset: 0, start: '18:30', end: '20:30', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: 18, organizer: 'Anime Club (sample org)',
  },
  {
    id: 'evt-hackathon-mixer', title: 'Hackathon Team Formation Mixer',
    description: 'Looking for teammates for the next hackathon? Quick intros, idea pitches and pizza. Designers, coders and first-timers all wanted.',
    categories: ['tech', 'social', 'career'], tags: ['hackathon', 'networking', 'pizza', 'teams'],
    campus: 'marietta', venue: 'J Building Atrium', address: 'J Building Atrium (sample)',
    dayOffset: 5, start: '18:00', end: '19:30', groupSize: 'medium', energy: 'high', beginnerFriendly: true, capacity: 60, organizer: 'AI Club (sample listing)',
  },
  {
    id: 'evt-maker-hours', title: 'Open Makerspace Hours',
    description: 'Ongoing weekday open hours: 3D printers, laser cutter and soldering stations with student staff to help you get started on any project.',
    categories: ['engineering', 'arts'], tags: ['3d printing', 'maker', 'build'],
    campus: 'marietta', venue: 'Q Building Makerspace', address: 'Q Building, Makerspace Lab (sample)',
    dayOffset: 0, start: '10:00', end: '18:00', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: null, organizer: 'Makerspace (sample listing)', kind: 'ongoing',
  },
  {
    id: 'evt-board-game-cafe', title: 'Board Game Café Night',
    description: 'Catan, Codenames and a stack of party games. Tables of four to six, hosts teach the rules, free hot chocolate. Perfect if you want to meet people without a crowd.',
    categories: ['gaming', 'social'], tags: ['board games', 'tabletop', 'chill', 'meet new people'],
    campus: 'kennesaw', venue: 'Carmichael Student Center', address: 'Carmichael Student Center, Room 274 (sample)',
    dayOffset: 1, start: '19:00', end: '22:00', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: 36, organizer: 'Tabletop Guild (sample org)',
  },
  {
    id: 'evt-smash-tournament', title: 'Smash Bros. Ultimate Tournament',
    description: 'Double-elimination bracket with 64 player slots, stream on the big screen and prizes for top 3. Spectators welcome.',
    categories: ['gaming', 'social'], tags: ['smash', 'tournament', 'nintendo', 'esports'],
    campus: 'kennesaw', venue: 'Carmichael Student Center Ballroom', address: 'Student Center Ballroom (sample)',
    dayOffset: 2, start: '13:00', end: '18:00', groupSize: 'large', energy: 'high', beginnerFriendly: false, capacity: 120, organizer: 'Esports Club (sample org)',
  },
  {
    id: 'evt-yoga-green', title: 'Sunday Morning Yoga on the Green',
    description: 'A gentle all-levels flow outside to reset before the week. Mats provided, quiet and low-key.',
    categories: ['wellness', 'outdoors'], tags: ['yoga', 'mindfulness', 'relax'],
    campus: 'kennesaw', venue: 'Campus Green', address: 'Kennesaw Campus Green (sample)',
    dayOffset: 2, start: '09:30', end: '10:30', groupSize: 'medium', energy: 'relaxed', beginnerFriendly: true, capacity: 50, organizer: 'Wellness (sample listing)',
  },
  {
    id: 'evt-open-mic', title: 'Open Mic & Acoustic Night',
    description: 'Sign up for a five-minute slot or just come listen: songs, poetry and stand-up from students. Coffee bar open all night.',
    categories: ['music', 'arts', 'social'], tags: ['open mic', 'music', 'comedy', 'poetry'],
    campus: 'kennesaw', venue: 'Bailey Performance Center Lobby', address: 'Performance Center Lobby (sample)',
    dayOffset: 0, start: '20:00', end: '22:30', groupSize: 'large', energy: 'relaxed', beginnerFriendly: true, capacity: 150, organizer: 'Music Society (sample org)',
  },
  {
    id: 'evt-habitat-build', title: 'Habitat Build Day',
    description: 'Spend a Saturday morning framing walls with a local build crew. Transportation from campus provided; closed-toe shoes required.',
    categories: ['volunteering', 'outdoors', 'social'], tags: ['volunteer', 'community', 'service'],
    campus: 'kennesaw', venue: 'Meet at the Student Center bus loop', address: 'Student Center bus loop (sample)',
    dayOffset: 1, start: '08:00', end: '13:00', groupSize: 'medium', energy: 'high', beginnerFriendly: true, capacity: 25, organizer: 'Volunteer Corps (sample org)',
  },
  {
    id: 'evt-ai-chatbot', title: 'AI Workshop: Build Your First Chatbot',
    description: 'Hands-on Python workshop: call an LLM API, give it a personality and deploy a tiny web chat. Bring a laptop; basic Python helps but is not required.',
    categories: ['tech', 'career', 'orgs'], tags: ['ai', 'python', 'workshop', 'llm'],
    campus: 'kennesaw', venue: 'Clendenin Computer Lab', address: 'Clendenin Building, Lab 1008 (sample)',
    dayOffset: 4, start: '17:30', end: '19:30', groupSize: 'medium', energy: 'relaxed', beginnerFriendly: true, capacity: 40, organizer: 'AI Club (sample listing)',
  },
  {
    id: 'evt-trail-run', title: 'Kennesaw Mountain Trail Run',
    description: 'A 4-mile social trail run with pace groups for beginners and regulars. Carpool leaves from the rec center.',
    categories: ['outdoors', 'sports'], tags: ['running', 'trail', 'hiking', 'nature'],
    campus: 'kennesaw', venue: 'Leaves from Kennesaw Rec Center', address: 'Recreation Center front entrance (sample)',
    dayOffset: 2, start: '08:00', end: '10:00', groupSize: 'medium', energy: 'high', beginnerFriendly: true, capacity: 30, organizer: 'Running Club (sample org)',
  },
  {
    id: 'evt-calc-study', title: 'Calc II Study Group',
    description: 'Weekly study table to work practice problems together before exams. Quiet, collaborative, bring your own questions.',
    categories: ['career'], tags: ['study', 'calculus', 'tutoring', 'exam'],
    campus: 'kennesaw', venue: 'Sturgis Library', address: 'Sturgis Library, Group Study Room 3 (sample)',
    dayOffset: 0, start: '15:00', end: '17:00', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: 10, organizer: 'Math study group (sample student group)', kind: 'ongoing',
  },
  {
    id: 'evt-pottery-paint', title: 'Pottery & Paint Social',
    description: 'Paint a mug or try the wheel for the first time. All materials included, relaxed music, great way to unwind with new people.',
    categories: ['arts', 'wellness', 'social'], tags: ['pottery', 'painting', 'craft', 'relax'],
    campus: 'kennesaw', venue: 'Zuckerman Museum Studio', address: 'Museum Studio Classroom (sample)',
    dayOffset: 3, start: '18:00', end: '20:00', groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, capacity: 20, organizer: 'Art Collective (sample org)',
  },
];

function buildEvent(sample: SampleEvent, now: Date): CampusEvent {
  const day = campusDateKey(new Date(now.getTime() + sample.dayOffset * DAY_MS));
  const start = campusTimeToUtc(day, sample.start);
  const isOngoing = sample.kind === 'ongoing';
  const endDay = isOngoing ? campusDateKey(new Date(now.getTime() + ONGOING_SPAN_DAYS * DAY_MS)) : day;
  return {
    id: sample.id,
    title: sample.title,
    description: sample.description,
    categories: sample.categories,
    tags: sample.tags,
    kind: sample.kind ?? 'event',
    campus: sample.campus,
    venue: sample.venue,
    address: sample.address,
    start: start.toISOString(),
    end: campusTimeToUtc(endDay, sample.end).toISOString(),
    groupSize: sample.groupSize,
    energy: sample.energy,
    beginnerFriendly: sample.beginnerFriendly,
    capacity: sample.capacity,
    visibility: 'public',
    organizer: { name: sample.organizer, kind: 'organization', studentId: null, verification: 'sample-data' },
    source: SAMPLE_SOURCE,
    rsvpUrl: null,
    coverImageUrl: null,
    createdAt: now.toISOString(),
    status: 'active',
    reports: [],
  };
}

const BLANK_SOCIAL = { makeFriends: false, groupSize: 'any', tryNew: false, energy: 'any' } as const;

/** Demo students. Maya starts un-onboarded so the live demo walks through onboarding. */
function buildStudents(): Student[] {
  const base = { socialVisible: true, aiProfile: null } as const;
  return [
    {
      ...base, id: 'stu-jordan', name: 'Jordan Reyes', major: 'Computer Science', year: 'Junior', avatarColor: '#FFC629',
      onboarded: true, campus: 'marietta', interests: ['gaming', 'tech', 'social'], availability: ['weekends', 'evenings'],
      about: 'I run game nights in my dorm and want more people to play with.',
      social: { makeFriends: true, groupSize: 'small', tryNew: false, energy: 'relaxed' },
    },
    {
      ...base, id: 'stu-maya', name: 'Maya Chen', major: 'Software Engineering', year: 'Sophomore', avatarColor: '#7DD3FC',
      onboarded: false, campus: 'both', interests: [], availability: [], about: '', social: BLANK_SOCIAL,
    },
    {
      ...base, id: 'stu-alex', name: 'Alex Kim', major: 'Mechanical Engineering', year: 'Senior', avatarColor: '#A7F3D0',
      onboarded: true, campus: 'marietta', interests: ['engineering', 'gaming', 'sports'], availability: ['weekends', 'evenings'],
      about: 'Robotics, pickup hoops and Mario Kart.', social: { makeFriends: true, groupSize: 'any', tryNew: true, energy: 'any' },
    },
    {
      ...base, id: 'stu-priya', name: 'Priya Patel', major: 'Interactive Design', year: 'Junior', avatarColor: '#F9A8D4',
      onboarded: true, campus: 'kennesaw', interests: ['arts', 'wellness', 'music'], availability: ['evenings', 'weekends'],
      about: 'Illustrator who loves open mics and calm, creative nights.', social: { makeFriends: true, groupSize: 'small', tryNew: true, energy: 'relaxed' },
    },
    {
      ...base, id: 'stu-sam', name: 'Sam Okafor', major: 'Information Technology', year: 'Freshman', avatarColor: '#FDBA74',
      onboarded: true, campus: 'both', interests: ['gaming', 'sports', 'social'], availability: ['weekdays', 'weekends', 'evenings'],
      about: 'New to KSU, trying to meet people. Big on Smash and basketball.', social: { makeFriends: true, groupSize: 'large', tryNew: true, energy: 'high' },
    },
  ];
}

/** Pre-existing swipes/opt-ins from the other demo students so counts start from real records. */
const SEED_INTEREST: [studentId: string, eventId: string, optIn: boolean][] = [
  ['stu-alex', 'evt-gamedev-101', true],
  ['stu-sam', 'evt-gamedev-101', false],
  ['stu-alex', 'evt-pickup-hoops', true],
  ['stu-sam', 'evt-pickup-hoops', true],
  ['stu-sam', 'evt-smash-tournament', true],
  ['stu-priya', 'evt-open-mic', true],
  ['stu-priya', 'evt-pottery-paint', false],
  ['stu-sam', 'evt-board-game-cafe', true],
  ['stu-jordan', 'evt-board-game-cafe', false],
  ['stu-alex', 'evt-robotics-build', false],
];

/**
 * Builds a fresh database. The app starts with no sample events
 * (`sampleEvents: false`); tests and the e2e/screenshot fixtures opt in to the
 * sample dataset, which is the default here so fixtures stay one call.
 */
export function createSeedDatabase(now: Date, { sampleEvents = true }: { sampleEvents?: boolean } = {}): Database {
  const at = now.toISOString();
  const interest = sampleEvents ? SEED_INTEREST : [];
  return {
    version: 1,
    seededAt: at,
    students: buildStudents(),
    events: sampleEvents ? SAMPLE_EVENTS.map((sample) => buildEvent(sample, now)) : [],
    swipes: interest.map(([studentId, eventId]) => ({ studentId, eventId, decision: 'interested', at })),
    connections: interest.filter(([, , optIn]) => optIn).map(([studentId, eventId]) => ({ studentId, eventId, at })),
    joinRequests: [],
  };
}

/** Drops sample events and every swipe, connection and join request that points at them. */
export function withoutSampleEvents(db: Database): Database {
  const sampleIds = new Set(db.events.filter((e) => e.source.type === 'sample').map((e) => e.id));
  if (sampleIds.size === 0) return db;
  const keep = <T extends { eventId: string }>(rows: T[]) => rows.filter((r) => !sampleIds.has(r.eventId));
  return {
    ...db,
    events: db.events.filter((e) => !sampleIds.has(e.id)),
    swipes: keep(db.swipes),
    connections: keep(db.connections),
    joinRequests: keep(db.joinRequests),
  };
}
