/**
 * Records the ~90-second demo video by driving the real app (no mock-ups).
 * Needs the app running (`npm run dev`). Output: docs/demo-video/owlmatch-demo.webm
 *   BASE=http://localhost:5173 node scripts/record-demo.mjs
 *   ffmpeg -i docs/demo-video/owlmatch-demo.webm -c:v libx264 -pix_fmt yuv420p docs/demo-video/owlmatch-demo.mp4
 */
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT_DIR = path.resolve('docs/demo-video');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const SIZE = { width: 430, height: 932 };
const COVER = path.resolve('docs/demo-assets/game-night-cover.jpg');
const ABOUT = "I'm a software engineering student into gaming and programming. I want to make friends, but I prefer casual, small-group hangouts.";

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: RAW_DIR, size: SIZE } });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

/** A caption bar over the top of the screen so the silent video explains itself. */
async function caption(text) {
  await page.evaluate((t) => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      Object.assign(bar.style, {
        position: 'fixed', left: '12px', right: '12px', bottom: '84px', zIndex: '9999', padding: '12px 16px',
        borderRadius: '16px', background: 'rgba(0,0,0,.88)', color: '#fff', font: '600 15px/1.35 Inter, system-ui, sans-serif',
        boxShadow: '0 10px 30px rgba(0,0,0,.3)', pointerEvents: 'none',
      });
      document.body.appendChild(bar);
    }
    bar.innerHTML = t;
  }, text);
}

async function card(title, subtitle) {
  await page.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif">
    <img src="${BASE}/owlmatch-icon.svg" width="64" height="64" style="margin-bottom:24px"/>
    <div style="font-size:44px;font-weight:800;letter-spacing:-1.5px;line-height:1.05">${title}</div>
    <div style="margin-top:16px;font-size:19px;color:#cfcfcf;line-height:1.4">${subtitle}</div></body>`);
}

const typeSlowly = (locator, text) => locator.pressSequentially(text, { delay: 18 });

await page.request.post(`${BASE}/api/demo/reset`);

// 0:00 — Problem
await card('Campus life is<br/><span style="color:#FFC629">scattered.</span>', 'Hundreds of things to do at KSU, spread across calendars, apps and group chats. And showing up alone is hard.');
await pause(4500);

// Scene 1 — Jordan posts an event
await page.goto(`${BASE}/create?as=stu-jordan`);
await caption('<b style="color:#FFC629">Jordan</b> posts a casual game night on the Marietta campus');
await pause(1500);
await page.getByRole('button', { name: 'Demo example' }).click();
await pause(1200);
await page.getByTestId('cover-input').setInputFiles(COVER);
await pause(1800);
await page.getByRole('button', { name: 'Publish event' }).click();
await page.getByRole('heading', { level: 1 }).waitFor();
await caption('Published. Any student can now discover it.');
await pause(2500);

// Scene 2 — Maya onboards
await page.goto(`${BASE}/welcome?as=stu-maya`);
await pause(2500);
await page.getByRole('button', { name: 'Find My Matches' }).click();
await caption('<b style="color:#FFC629">Maya</b> is new. Onboarding takes about a minute.');
await page.getByRole('radio', { name: /Marietta Campus/ }).click();
await pause(700);
await page.getByRole('button', { name: 'Continue' }).click();
for (const interest of ['Gaming', 'Technology & Coding', 'Social Events']) {
  await page.getByRole('button', { name: interest }).click();
  await pause(450);
}
await pause(600);
await page.getByRole('button', { name: 'Continue' }).click();
for (const choice of ['Yes, definitely', 'Small groups', 'Relaxed']) {
  await page.getByRole('button', { name: choice }).click();
  await pause(400);
}
await page.getByRole('button', { name: 'Continue' }).click();
await caption('She describes herself <b>in her own words</b>. The AI reads this.');
await typeSlowly(page.getByLabel('About you'), ABOUT);
await pause(900);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Weekends' }).click();
await page.getByRole('button', { name: 'Evenings' }).click();
await pause(500);
await page.getByRole('button', { name: 'Build my matches' }).click();
await page.getByRole('heading', { name: /You're all set/ }).waitFor({ timeout: 30000 });
await caption('Her words become a structured profile: keywords, group size, energy, goals.');
await pause(4000);

// Scene 3 — AI recommendation
await page.getByRole('button', { name: 'Start discovering' }).click();
await page.getByRole('article').first().waitFor();
await caption('Jordan\'s game night is her <b style="color:#FFC629">#1 match</b>, with a reason grounded in her profile and the event.');
await pause(5000);

// Scene 4 — Swipe right + connect
await caption('She swipes right…');
const card0 = page.getByRole('article').first();
const box = await card0.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2 - 20, { steps: 18 });
  await page.mouse.up();
}
const sheet = page.getByRole('dialog');
await sheet.waitFor();
await pause(1200);
await caption('…opts in to find people going, and sees <b>Jordan is hosting</b>. Visibility is mutual and opt-in.');
await sheet.getByText('Show me to others going').click();
await sheet.getByText('Host').waitFor();
await pause(3800);

// Scene 5 — Calendar + My Matches
// (We stay in the app: a fresh recording browser isn't signed in to Google, so it would show a login page.)
await sheet.getByRole('link', { name: /Details/ }).click();
const calendarButton = page.getByRole('link', { name: 'Add to Google Calendar' });
await calendarButton.scrollIntoViewIfNeeded();
await calendarButton.evaluate((el) => { el.style.boxShadow = '0 0 0 4px #FFC629'; });
await caption('<b>Add to Google Calendar</b> opens a prefilled event with the time, place and details.');
await pause(4000);
await page.goto(`${BASE}/matches?as=stu-maya`);
await caption('Saved in <b>My Matches</b>, marked "Going together".');
await pause(3500);

// Scene 6 — Concierge
await page.goto(`${BASE}/ai?as=stu-maya`);
await caption('Or she can just ask the <b style="color:#FFC629">Campus Concierge</b>.');
await pause(1500);
await page.getByRole('button', { name: /Find me something fun on Marietta/ }).click();
await page.getByText(/Searching campus activities/).waitFor({ state: 'detached', timeout: 40000 });
await caption('Answers come only from real OwlMatch events, never invented ones.');
await pause(3000);
await page.mouse.wheel(0, 500);
await pause(4000);

// Close
await card('Discover your interests.<br/><span style="color:#FFC629">Find your people.</span>', 'OwlMatch: a student-built project for KSU AI Club Hackathon 2026. Not an official KSU service.');
await pause(4000);

await context.close();
await browser.close();
const [file] = readdirSync(RAW_DIR);
renameSync(path.join(RAW_DIR, file), path.join(OUT_DIR, 'owlmatch-demo.webm'));
rmSync(RAW_DIR, { recursive: true, force: true });
console.log('Saved', path.join(OUT_DIR, 'owlmatch-demo.webm'));
