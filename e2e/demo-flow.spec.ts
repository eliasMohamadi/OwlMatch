import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The judged demo story (docs/DEMO.md), end to end through the real UI and API:
 * Student A creates an event → Student B onboards → AI recommends it → B swipes
 * right and opts in to meet people → calendar link → My Matches → Concierge.
 */

const EVENT_TITLE = 'Casual Game Night: Smash, Mario Kart & Indie Games';
const COVER = path.resolve('docs/demo-assets/game-night-cover.jpg');

async function as(page: Page, studentId: string, route: string) {
  await page.goto(`${route}?as=${studentId}`);
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/demo/reset');
});

test('two-student demo story', async ({ page }) => {
  // Scene 1 — Jordan publishes a gaming meetup with a cover image.
  await as(page, 'stu-jordan', '/create');
  await page.getByRole('button', { name: 'Demo example' }).click();
  await page.getByTestId('cover-input').setInputFiles(COVER);
  await expect(page.getByRole('img', { name: /Cover image for/ })).toBeVisible();
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByRole('heading', { level: 1, name: EVENT_TITLE })).toBeVisible();

  // Scene 2 — Maya onboards.
  await as(page, 'stu-maya', '/discover');
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole('button', { name: 'Find My Matches' }).click();
  await page.getByRole('radio', { name: /Marietta Campus/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const interest of ['Gaming', 'Technology & Coding', 'Social Events']) {
    await page.getByRole('button', { name: interest }).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, definitely' }).click();
  await page.getByRole('button', { name: 'Small groups' }).click();
  await page.getByRole('button', { name: 'Relaxed' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByLabel('About you')
    .fill("I'm a software engineering student into gaming and programming. I want to make friends, but I prefer casual, small-group hangouts.");
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Weekends' }).click();
  await page.getByRole('button', { name: 'Evenings' }).click();
  await page.getByRole('button', { name: 'Build my matches' }).click();
  await expect(page.getByRole('heading', { name: /You're all set, Maya/ })).toBeVisible();
  await page.getByRole('button', { name: 'Start discovering' }).click();

  // Scene 3 — the new meetup is recommended first, with a grounded reason.
  const topCard = page.getByRole('article').first();
  await expect(topCard.getByRole('heading', { name: EVENT_TITLE })).toBeVisible();
  await expect(topCard.getByText(/gaming/i).first()).toBeVisible();

  // Scene 4 — swipe right (button alternative), opt in, see the host.
  await page.getByRole('button', { name: 'Interested', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(/1 interested on OwlMatch/)).toBeVisible();
  await sheet.getByText('Show me to others going').click();
  await expect(sheet.getByText('Jordan')).toBeVisible();
  await expect(sheet.getByText('Host')).toBeVisible();

  // Scene 5 — Google Calendar link and My Matches.
  const calendarHref = await sheet.getByRole('link', { name: /Calendar/ }).getAttribute('href');
  expect(calendarHref).toContain('calendar.google.com/calendar/render');
  expect(calendarHref).toContain(encodeURIComponent('Casual Game Night').replace(/%20/g, '+'));
  await sheet.getByRole('button', { name: 'Keep swiping' }).click();
  await page.getByRole('link', { name: 'Matches' }).last().click();
  await expect(page.getByRole('link', { name: EVENT_TITLE, exact: true })).toBeVisible();

  // Scene 6 — concierge answers from real events.
  await page.getByRole('link', { name: 'AI' }).last().click();
  await page.getByLabel('Ask the concierge').fill('Find me something fun on Marietta Campus where I can meet other people who like gaming.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('link', { name: EVENT_TITLE, exact: true })).toBeVisible({ timeout: 30_000 });
});

test('event form rejects invalid input', async ({ page }) => {
  await as(page, 'stu-jordan', '/create');
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByText('Give your event a name')).toBeVisible();
  await expect(page.getByText('Pick at least one category')).toBeVisible();
});
