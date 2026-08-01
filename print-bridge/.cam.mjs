import { chromium, devices } from 'playwright';
const OUT='/tmp/claude-0/-home-user-Boucherie/f56b47cf-b3b7-5203-8f9b-122873191366/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const [label, opts] of [
  ['TÉLÉPHONE', { ...devices['Pixel 5'] }],
  ['BUREAU',    { viewport: { width: 1280, height: 900 } }],
]) {
  const ctx = await b.newContext(opts);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:9123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByText('Admin', { exact: true }).click();
  await page.waitForTimeout(300);
  for (const d of ['1','2','3','4']) await page.locator('.numpad button', { hasText: new RegExp(`^${d}$`) }).click();
  await page.waitForTimeout(900);
  console.log(`\n--- ${label} ---`);
  console.log('  pointer:coarse    :', await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
  console.log('  maxTouchPoints    :', await page.evaluate(() => navigator.maxTouchPoints));
  console.log('  capture supporté  :', await page.evaluate(() => 'capture' in document.createElement('input')));
  // aller dans Produits puis ouvrir un article
  if (label === 'TÉLÉPHONE') { await page.locator('.bottomnav button').nth(1).click(); }
  else { await page.locator('.nav-item', { hasText: 'Produits' }).click(); }
  await page.waitForTimeout(900);
  const edit = page.locator('.btn-icon').first();
  await edit.click().catch(() => {});
  await page.waitForTimeout(900);
  const cam = await page.locator('button', { hasText: 'Prendre une photo' }).count();
  const gal = await page.locator('button', { hasText: /Galerie|Photo/ }).count();
  console.log('  bouton caméra     :', cam ? 'PRÉSENT' : 'ABSENT');
  console.log('  bouton galerie    :', gal ? 'présent' : 'absent');
  await page.screenshot({ path: `${OUT}/32-cam-${label.toLowerCase()}.png` });
  await ctx.close();
}
await b.close();
