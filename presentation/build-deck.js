/**
 * Builds presentation/OwlMatch-Pitch.pptx from real app screenshots (docs/screenshots).
 * Run: cd presentation && npm install && node build-deck.js
 */
const path = require('node:path');
const fs = require('node:fs');
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Lu = require('react-icons/lu');

const SKILL_THEME = process.env.APPLY_THEME_PATH; // optional: pptx skill's apply_theme.js
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const OUT = path.join(__dirname, 'OwlMatch-Pitch.pptx');

const THEME = {
  name: 'OwlMatch',
  headFontFace: 'Arial',
  bodyFontFace: 'Arial',
  colors: {
    dk1: '000000', lt1: 'FFFFFF', dk2: '171717', lt2: 'F5F5F2',
    accent1: 'FFC629', accent2: '666666', accent3: 'E8E8E3', accent4: 'FFF4D1', accent5: 'B0B3B2', accent6: 'E0A800',
    hlink: '000000', folHlink: '666666',
  },
};
const HEX = { gold: 'FFC629', goldSoft: 'FFF4D1', ink: '000000', charcoal: '171717', muted: '666666', line: 'E8E8E3', surface: 'F5F5F2', white: 'FFFFFF' };

async function icon(Component, color = '#000000', size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Component, { size, color, strokeWidth: 2 }));
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

async function logoData() {
  const png = await sharp(path.join(ROOT, 'public', 'owlmatch-icon.svg')).resize(512, 512).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

/** Slide title in the same position, size and alignment on every content slide. */
function title(slide, text, { w = 9, color = HEX.ink } = {}) {
  slide.addText(text, { x: 0.5, y: 0.4, w, h: 0.65, fontSize: 30, bold: true, color, align: 'left', valign: 'top', margin: 0, isTextBox: true, objectName: 'title' });
}

const shot = (name) => path.join(SHOTS, `${name}.png`);

/** Phone-style frame around a mobile screenshot (430×932 → ratio 0.4614). */
function phone(slide, name, x, y, h, label) {
  const w = h * 0.4614;
  slide.addShape('roundRect', { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.22, fill: { color: HEX.ink }, line: { color: HEX.ink }, objectName: `${name}-frame` });
  slide.addImage({ path: shot(name), x, y, w, h, rounding: false, altText: label ?? name, objectName: name });
  if (label) {
    slide.addText(label, { x: x - 0.25, y: y + h + 0.12, w: w + 0.5, h: 0.3, fontSize: 11, color: HEX.muted, align: 'center', isTextBox: true, margin: 0 });
  }
  return w;
}

async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; // 10 × 5.625 in
  pres.title = 'OwlMatch — Discover your interests. Find your people.';
  pres.author = 'OwlMatch team';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

  const logo = await logoData();

  pres.defineSlideMaster({
    title: 'DARK',
    background: { color: HEX.ink },
    objects: [{ image: { data: logo, x: 0.5, y: 5.0, w: 0.32, h: 0.32 } }, { text: { text: 'OwlMatch', options: { x: 0.9, y: 5.0, w: 2, h: 0.32, fontSize: 11, bold: true, color: HEX.white, margin: 0, valign: 'middle' } } }],
    slideNumber: { x: 9.1, y: 5.05, w: 0.4, h: 0.25, fontSize: 10, color: '8A8A8A', align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'LIGHT',
    background: { color: HEX.white },
    objects: [
      { image: { data: logo, x: 0.5, y: 5.08, w: 0.26, h: 0.26 } },
      { text: { text: 'OwlMatch · KSU AI Club Hackathon 2026', options: { x: 0.85, y: 5.08, w: 4, h: 0.26, fontSize: 9, color: HEX.muted, margin: 0, valign: 'middle' } } },
    ],
    slideNumber: { x: 9.1, y: 5.1, w: 0.4, h: 0.25, fontSize: 9, color: HEX.muted, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'GOLD',
    background: { color: HEX.gold },
    slideNumber: { x: 9.1, y: 5.1, w: 0.4, h: 0.25, fontSize: 9, color: HEX.ink, align: 'right' },
  });

  /* ---------------- 1. Title ---------------- */
  pres.addSection({ title: 'Story' });
  let s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Story' });
  s.addShape('ellipse', { x: 6.4, y: -1.6, w: 5, h: 5, fill: { color: HEX.gold, transparency: 72 }, line: { type: 'none' }, objectName: 'glow' });
  s.addImage({ data: logo, x: 0.5, y: 0.55, w: 0.7, h: 0.7, objectName: 'logo' });
  s.addText('OwlMatch', { x: 0.5, y: 1.45, w: 5.6, h: 0.9, fontSize: 54, bold: true, color: HEX.white, margin: 0, isTextBox: true, objectName: 'name' });
  s.addText([{ text: 'Discover your interests.', options: { color: HEX.white, breakLine: true } }, { text: 'Find your people.', options: { color: HEX.gold } }], { x: 0.5, y: 2.35, w: 5.8, h: 0.85, fontSize: 24, bold: true, margin: 0, valign: 'top', isTextBox: true, objectName: 'tagline' });
  s.addText('An AI-powered way for KSU students to find campus activities they’ll actually enjoy — and people to go with.', { x: 0.5, y: 3.35, w: 5.4, h: 0.8, fontSize: 15, color: 'CFCFCF', margin: 0, isTextBox: true, objectName: 'oneliner' });
  s.addText('Student-built hackathon project inspired by KSU · not an official university service', { x: 0.5, y: 4.35, w: 5.6, h: 0.3, fontSize: 10, color: '8A8A8A', margin: 0, isTextBox: true });
  phone(s, '07-discover-recommendation', 7.1, 0.5, 4.5);
  s.addNotes('Hi, we built OwlMatch. One line: it turns what a student says they’re into into a personalized feed of real campus activities, and helps them find people to go with. Let’s start with the problem.');

  /* ---------------- 2. Problem ---------------- */
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Story' });
  title(s, 'Getting involved is harder than it should be');
  const problems = [
    [Lu.LuShuffle, 'It’s scattered', 'Events live across the KSU calendar, Owl Life, Handshake, flyers and group chats. Nobody checks all of them.'],
    [Lu.LuSearchX, 'It’s not personal', 'Listings are sorted by date, not by you. Finding something that fits your interests and schedule takes real effort.'],
    [Lu.LuUserX, 'Going alone is hard', 'Many students skip events because they don’t know anyone going — especially freshmen, transfers and commuters.'],
  ];
  for (let i = 0; i < problems.length; i++) {
    const [Ic, head, body] = problems[i];
    const x = 0.5 + i * 3.08;
    s.addShape('roundRect', { x, y: 1.45, w: 2.85, h: 3.2, rectRadius: 0.18, fill: { color: HEX.surface }, line: { type: 'none' }, objectName: `card-${i}` });
    s.addShape('ellipse', { x: x + 0.3, y: 1.75, w: 0.7, h: 0.7, fill: { color: HEX.gold }, line: { type: 'none' } });
    s.addImage({ data: await icon(Ic), x: x + 0.47, y: 1.92, w: 0.36, h: 0.36 });
    s.addText(head, { x: x + 0.3, y: 2.65, w: 2.4, h: 0.45, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.3, y: 3.1, w: 2.3, h: 1.4, fontSize: 13, color: HEX.charcoal, margin: 0, valign: 'top', isTextBox: true });
  }
  s.addNotes('Three problems. First, information is scattered across platforms. Second, nothing is personalized — you scroll a date-sorted list. Third, even when you find something, walking in alone is intimidating. We did not have time to run a survey this week, so we are not quoting numbers; our first rollout step is an in-app survey to measure this.');

  /* ---------------- 3. Solution ---------------- */
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Story' });
  title(s, 'One loop: discover to attend', { w: 6.8 });
  const steps = [
    [Lu.LuSparkles, 'Discover', 'Tell OwlMatch about yourself in your own words.'],
    [Lu.LuHeart, 'Match', 'Swipe AI-ranked activities, each with a reason.'],
    [Lu.LuUsers, 'Connect', 'Opt in to see who else is going. Mutual only.'],
    [Lu.LuCalendarCheck, 'Attend', 'One tap to Google Calendar. Saved in My Matches.'],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [Ic, head, body] = steps[i];
    const x = 0.5 + i * 1.62;
    s.addShape('ellipse', { x: x + 0.38, y: 1.45, w: 0.75, h: 0.75, fill: { color: i === 1 ? HEX.gold : HEX.ink }, line: { type: 'none' } });
    s.addImage({ data: await icon(Ic, i === 1 ? '#000000' : '#FFC629'), x: x + 0.56, y: 1.63, w: 0.39, h: 0.39 });
    if (i < steps.length - 1) s.addImage({ data: await icon(Lu.LuArrowRight, '#B0B3B2'), x: x + 1.36, y: 1.67, w: 0.3, h: 0.3 });
    s.addText(head, { x, y: 2.35, w: 1.5, h: 0.4, fontSize: 16, bold: true, color: HEX.ink, align: 'center', margin: 0, isTextBox: true });
    s.addText(body, { x, y: 2.75, w: 1.5, h: 1.1, fontSize: 12, color: HEX.charcoal, align: 'center', margin: 0, valign: 'top', isTextBox: true });
  }
  s.addShape('roundRect', { x: 0.5, y: 4.0, w: 6.3, h: 0.75, rectRadius: 0.14, fill: { color: HEX.goldSoft }, line: { type: 'none' } });
  s.addText('Any student can post an activity — game night, pickup game, study group — and OwlMatch finds the students who’d love it.', { x: 0.7, y: 4.05, w: 6.0, h: 0.65, fontSize: 13, color: HEX.ink, margin: 0, valign: 'middle', isTextBox: true });
  phone(s, '08-going-together', 7.55, 0.45, 4.35);
  s.addNotes('Our solution is one loop. Discover: onboarding takes about a minute and includes one free-text question. Match: you swipe through AI-ranked activities, each with a specific reason. Connect: if you and another student both opt in, you can see each other — first name and major only. Attend: one tap to Google Calendar. And it is two-sided — students can post their own activities.');

  /* ---------------- 4. AI engine ---------------- */
  pres.addSection({ title: 'How it works' });
  s = pres.addSlide({ masterName: 'GOLD', sectionTitle: 'How it works' });
  title(s, 'AI is the engine, not an add-on');
  const pipe = [
    ['1', 'Understand', 'Gemini turns the student’s own words into a validated profile'],
    ['2', 'Filter', 'Code enforces campus, time, visibility, moderation'],
    ['3', 'Shortlist', 'Scores 5 signals: interests, keywords, schedule, social fit, swipes'],
    ['4', 'Re-rank + explain', 'Gemini ranks the top 10 and writes a reason grounded in real events'],
    ['5', 'Learn', 'Every swipe is saved and shapes the next ranking'],
  ];
  for (let i = 0; i < pipe.length; i++) {
    const [n, head, body] = pipe[i];
    const y = 1.3 + i * 0.72;
    const isAi = i === 0 || i === 3;
    s.addShape('roundRect', { x: 0.5, y, w: 5.3, h: 0.6, rectRadius: 0.12, fill: { color: isAi ? HEX.ink : HEX.white }, line: { type: 'none' }, objectName: `step-${n}` });
    s.addText(n, { x: 0.62, y: y + 0.1, w: 0.4, h: 0.4, fontSize: 16, bold: true, color: isAi ? HEX.gold : HEX.ink, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText([{ text: `${head}  `, options: { bold: true, color: isAi ? HEX.white : HEX.ink } }, { text: body, options: { color: isAi ? 'D6D6D6' : HEX.charcoal } }], { x: 1.1, y, w: 4.6, h: 0.6, fontSize: 12, valign: 'middle', margin: 0, isTextBox: true });
  }
  s.addShape('roundRect', { x: 6.15, y: 1.3, w: 3.35, h: 3.48, rectRadius: 0.16, fill: { color: HEX.white }, line: { type: 'none' }, objectName: 'guardrails' });
  s.addText('Guardrails', { x: 6.4, y: 1.45, w: 2.9, h: 0.4, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
  s.addText(
    [
      { text: 'Never invents events: unknown IDs are dropped', options: { bullet: { indent: 14 }, breakLine: true } },
      { text: 'Every model output is schema-validated (zod)', options: { bullet: { indent: 14 }, breakLine: true } },
      { text: 'Scores clamped 0–100 and labeled AI vs. rules', options: { bullet: { indent: 14 }, breakLine: true } },
      { text: 'Timeout → full rule-based fallback, clearly labeled', options: { bullet: { indent: 14 }, breakLine: true } },
      { text: 'API key stays on the server', options: { bullet: { indent: 14 } } },
    ],
    { x: 6.4, y: 1.9, w: 2.95, h: 2.7, fontSize: 12, color: HEX.charcoal, paraSpaceAfter: 6, valign: 'top', margin: 0, isTextBox: true },
  );
  s.addNotes('AI is the core. Step one: Gemini reads what the student wrote and produces a structured profile — inferred interests, keywords, group-size and energy preferences — validated with a schema. Step two: hard constraints are enforced in code, never by the model. Step three: a weighted scoring model shortlists events. Step four: Gemini re-ranks the shortlist and writes a reason grounded in the actual event. We drop any ID that is not in the shortlist, so it cannot hallucinate events. Step five: swipes feed back. If Gemini is down, the whole app still works on the rule-based path, and it says so.');

  /* ---------------- 5. Why not filtering ---------------- */
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'How it works' });
  title(s, 'Same events, smarter ranking');
  s.addText('Maya: “into gaming and programming… I prefer casual, small-group hangouts.”', { x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 14, italic: true, color: HEX.muted, margin: 0, isTextBox: true });
  const rows = [
    ['Category filter only', ['100%  Intro to Game Dev', '100%  Valorant Scrims & Tryouts', '67%  Hackathon Team Mixer', '50%  Anime & Sketch Night'], HEX.surface, HEX.ink],
    ['OwlMatch pipeline', ['Intro to Game Dev (small group)', 'Sunset Volleyball', 'Hackathon Team Mixer', 'Valorant ↓ (competitive, high-energy)'], HEX.ink, HEX.white],
  ];
  for (let i = 0; i < rows.length; i++) {
    const [head, items, fill, color] = rows[i];
    const x = 0.5 + i * 4.6;
    s.addShape('roundRect', { x, y: 1.65, w: 4.4, h: 3.1, rectRadius: 0.16, fill: { color: fill }, line: { type: 'none' }, objectName: `col-${i}` });
    s.addText(head, { x: x + 0.3, y: 1.85, w: 3.8, h: 0.4, fontSize: 17, bold: true, color: i === 1 ? HEX.gold : HEX.ink, margin: 0, isTextBox: true });
    s.addText(
      items.map((t, k) => ({ text: `${k + 1}.  ${t}`, options: { breakLine: k < items.length - 1 } })),
      { x: x + 0.3, y: 2.35, w: 3.85, h: 2.2, fontSize: 13, color, paraSpaceAfter: 9, valign: 'top', margin: 0, isTextBox: true },
    );
  }
  s.addNotes('Here is why this beats filtering. Same student, same events. A category filter ties competitive Valorant tryouts with a beginner game-dev workshop at 100 percent, because both are tagged gaming. OwlMatch reads that she wants casual, small groups, so the workshop leads and the tryouts drop. This exact comparison is live in the app under the Why AI tab — the figures shown are from our rule-based path; with Gemini enabled the reasons are written from her own words.');

  /* ---------------- 6. Demo ---------------- */
  pres.addSection({ title: 'Demo' });
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Demo' });
  title(s, 'The demo: two students, one game night');
  const demo = [
    ['02-event-published', 'Jordan posts a game night'],
    ['06-ai-profile', 'Maya’s AI profile'],
    ['07-discover-recommendation', 'It’s her top match'],
    ['08-going-together', 'Swipe right → go together'],
    ['10-concierge', 'Ask the concierge'],
  ];
  for (let i = 0; i < demo.length; i++) phone(s, demo[i][0], 0.62 + i * 1.84, 1.15, 3.45, demo[i][1]);
  s.addNotes('Live demo, or the video. Jordan posts a casual game night on the Marietta campus with a cover photo. Maya, a brand-new user, onboards and writes one sentence about herself. Jordan’s event is her top recommendation with a specific reason. She swipes right, opts in, and sees Jordan is hosting. One tap adds it to Google Calendar. Finally she asks the concierge in plain English and it answers from real OwlMatch events.');

  /* ---------------- 7. Architecture & feasibility ---------------- */
  pres.addSection({ title: 'Feasibility' });
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Feasibility' });
  title(s, 'Built to be adopted');
  const stack = [
    ['React + TypeScript app', 'Mobile-first, accessible, swipe or keyboard'],
    ['Node API + shared domain', 'One implementation of ranking & validation'],
    ['Gemini (server-side)', 'JSON mode, zod-validated, cached, timeout + fallback'],
    ['Storage', 'JSON store today → Supabase tables (mapped)'],
  ];
  for (let i = 0; i < stack.length; i++) {
    const y = 1.3 + i * 0.86;
    s.addShape('roundRect', { x: 0.5, y, w: 4.3, h: 0.72, rectRadius: 0.12, fill: { color: i === 2 ? HEX.ink : HEX.surface }, line: { type: 'none' }, objectName: `stack-${i}` });
    s.addText([{ text: stack[i][0], options: { bold: true, breakLine: true, color: i === 2 ? HEX.gold : HEX.ink } }, { text: stack[i][1], options: { color: i === 2 ? 'D6D6D6' : HEX.muted } }], { x: 0.7, y, w: 4, h: 0.72, fontSize: 12, valign: 'middle', margin: 0, isTextBox: true });
  }
  const feas = [
    [Lu.LuDatabase, 'Data', 'Student posts + KSU calendar feed next. No scraping of login-only sites.'],
    [Lu.LuCoins, 'Cost', 'One small Gemini call per refresh (≤10 events), cached; rules when offline.'],
    [Lu.LuRocket, 'Rollout', 'Pilot with Marietta student orgs, then KSU SSO.'],
    [Lu.LuShieldCheck, 'Quality', '39 unit tests + full E2E demo test in CI; strict TS; documented.'],
  ];
  for (let i = 0; i < feas.length; i++) {
    const [Ic, head, body] = feas[i];
    const y = 1.3 + i * 0.86;
    s.addShape('ellipse', { x: 5.2, y: y + 0.08, w: 0.52, h: 0.52, fill: { color: HEX.gold }, line: { type: 'none' } });
    s.addImage({ data: await icon(Ic), x: 5.33, y: y + 0.21, w: 0.26, h: 0.26 });
    s.addText([{ text: head, options: { bold: true, breakLine: true } }, { text: body, options: { color: HEX.charcoal } }], { x: 5.9, y, w: 3.6, h: 0.72, fontSize: 12, color: HEX.ink, valign: 'middle', margin: 0, isTextBox: true });
  }
  s.addNotes('Feasibility. The stack is standard and the codebase is organized for handoff: one shared domain package, strict TypeScript, 39 unit tests plus an end-to-end test of this exact demo running in CI, and architecture docs. Data: student-posted events work today; sample events are clearly labeled; a KSU calendar feed is the next adapter, and we do not scrape login-protected sites. Cost: Gemini only sees a shortlist of ten events per refresh and results are cached. Rollout: pilot with Marietta student organizations, then university sign-in.');

  /* ---------------- 8. Impact & next ---------------- */
  s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Feasibility' });
  title(s, 'What’s real today — and what’s next', { color: HEX.white });
  const now = ['AI profile, ranking, reasons & concierge', 'Student-created events with photos', 'Mutual “go together” opt-in', 'Google Calendar + My Matches', 'Labeled fallback when AI is offline'];
  const next = ['KSU calendar & Owl Life feeds (with permission)', 'KSU SSO + verified student orgs', 'Embeddings for richer semantic match', 'Group chat for people going together', 'Survey to measure belonging & attendance'];
  [['Working now', now, HEX.gold], ['Next', next, 'CFCFCF']].forEach(([head, items, color], i) => {
    const x = 0.5 + i * 4.6;
    s.addText(head, { x, y: 1.35, w: 4.2, h: 0.4, fontSize: 16, bold: true, color, margin: 0, isTextBox: true });
    s.addText(items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < items.length - 1 } })), { x, y: 1.8, w: 4.2, h: 2.2, fontSize: 13, color: HEX.white, paraSpaceAfter: 6, valign: 'top', margin: 0, isTextBox: true });
  });
  s.addText([{ text: 'Discover your interests. ', options: { color: HEX.white } }, { text: 'Find your people.', options: { color: HEX.gold } }], { x: 0.5, y: 4.15, w: 9, h: 0.6, fontSize: 26, bold: true, margin: 0, isTextBox: true, objectName: 'closing' });
  s.addNotes('Everything on the left works today and you just saw it. On the right is the honest roadmap: real KSU data feeds with permission, university sign-in, embeddings, and measuring impact on belonging and attendance. OwlMatch: discover your interests, find your people. Thank you.');

  await pres.writeFile({ fileName: OUT });
  if (SKILL_THEME && fs.existsSync(SKILL_THEME)) {
    const { applyTheme } = require(SKILL_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log('wrote', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
