import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN_PASSWORD } from './constants';

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

type Pointer = 'mouse' | 'touch';

/** Drags the top card horizontally with a real press-move-release, by mouse or by finger (touch events). */
async function dragCard(page: Page, dx: number, pointer: Pointer = 'mouse') {
  const box = (await page.getByRole('article').first().boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const steps = 12;
  if (pointer === 'mouse') {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Signs this browser in as admin (page.request shares the page's cookies), then resets the data. */
async function signInAsAdmin(page: Page) {
  const signIn = await page.request.post('/api/auth/admin', { data: { password: E2E_ADMIN_PASSWORD } });
  expect(signIn.ok()).toBe(true);
  const reset = await page.request.post('/api/demo/reset');
  expect(reset.ok()).toBe(true);
}

test.describe('signed out', () => {
  test('shows the sign-in page and the API refuses requests', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: 'Sign in to OwlMatch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeVisible();
    expect((await page.request.get('/api/students/stu-jordan')).status()).toBe(401);
    expect((await page.request.post('/api/demo/reset')).status()).toBe(401);
  });
});

test.describe('admin acting as demo students', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
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

  for (const pointer of ['mouse', 'touch'] as const) {
    test(`swiping by ${pointer} decides the card on release instead of opening details`, async ({ page }) => {
      await as(page, 'stu-sam', '/discover');
      const topTitle = () => page.getByRole('article').first().getAttribute('aria-label');
      await expect(page.getByRole('article').first()).toBeVisible();
      await expect(page.getByRole('search')).toHaveCount(0); // the search bar is gone

      // Swipe right: interest is saved (the match sheet opens) and we stay on Discover.
      const first = await topTitle();
      await dragCard(page, 240, pointer);
      await expect(page.getByRole('dialog').getByText(/interested on OwlMatch/)).toBeVisible();
      await expect(page).toHaveURL(/\/discover/);
      await page.getByRole('dialog').getByRole('button', { name: 'Keep swiping' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0); // let the sheet finish closing
      await expect(page.getByRole('article').first()).not.toHaveAttribute('aria-label', first!);

      // Swipe left: the card is passed, no sheet, still on Discover.
      const second = await topTitle();
      await dragCard(page, -240, pointer);
      await expect(page.getByRole('article').first()).not.toHaveAttribute('aria-label', second!);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL(/\/discover/);

      // A short drag that doesn't reach the threshold springs back and does nothing.
      const third = await topTitle();
      await dragCard(page, 40, pointer);
      await expect(page).toHaveURL(/\/discover/);
      await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', third!);

      // A plain tap still opens the details.
      if (pointer === 'touch') await page.getByRole('article').first().tap();
      else await page.getByRole('article').first().click();
      await expect(page).toHaveURL(/\/events\//);
    });
  }

  test('settings can turn off the pop-up after swiping right', async ({ page }) => {
    // Profile → Settings, switch the pop-up off. The setting is saved to the account.
    await as(page, 'stu-sam', '/profile');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
    const popUp = page.getByRole('switch', { name: /Pop-up after swiping right/ });
    await expect(popUp).toBeChecked();
    await popUp.click({ force: true });
    await expect(popUp).not.toBeChecked();

    // Swiping right now saves quietly: a toast, no sheet.
    await page.reload(); // the saved value comes back from the server
    await expect(page.getByRole('switch', { name: /Pop-up after swiping right/ })).not.toBeChecked();
    await as(page, 'stu-sam', '/discover');
    const first = await page.getByRole('article').first().getAttribute('aria-label');
    await dragCard(page, 240);
    await expect(page.getByText('Saved to My Matches')).toBeVisible();
    await expect(page.getByRole('article').first()).not.toHaveAttribute('aria-label', first!);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Back on: the sheet returns.
    await as(page, 'stu-sam', '/settings');
    await page.getByRole('switch', { name: /Pop-up after swiping right/ }).click({ force: true });
    await expect(page.getByRole('switch', { name: /Pop-up after swiping right/ })).toBeChecked();
    await as(page, 'stu-sam', '/discover');
    await dragCard(page, 240);
    await expect(page.getByRole('dialog').getByText(/interested on OwlMatch/)).toBeVisible();
  });

  test('event form rejects invalid input', async ({ page }) => {
    await as(page, 'stu-jordan', '/create');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByText('Give your event a name')).toBeVisible();
    await expect(page.getByText('Pick at least one category')).toBeVisible();
  });
});
