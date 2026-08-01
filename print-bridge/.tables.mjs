import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-Boucherie/f56b47cf-b3b7-5203-8f9b-122873191366/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await page.goto('http://127.0.0.1:9123/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.getByText('Admin', { exact: true }).click();
await page.waitForTimeout(300);
for (const d of ['1','2','3','4']) await page.locator('.numpad button', { hasText: new RegExp(`^${d}$`) }).click();
await page.waitForTimeout(900);
for (const d of ['5','0','0']) await page.locator('.numpad button', { hasText: new RegExp(`^${d}$`) }).click();
await page.locator('.btn-success').first().click();
await page.waitForTimeout(900);

const addFirstProduct = async (n=1) => {
  await page.locator('.prod-card').nth(n).click();
  await page.waitForTimeout(400);
  await page.locator('.numpad button', { hasText: /^1$/ }).click();
  await page.locator('.modal-foot button', { hasText: 'Ajouter' }).click();
  await page.waitForTimeout(500);
};
const total = () => page.locator('.cart-totals .row.grand span').last().innerText();

console.log('barre de tables visible :', await page.locator('.table-bar').count() > 0);
// Table 3 : on y met un article
await page.locator('.table-chip', { hasText: 'Table 3' }).click(); await page.waitForTimeout(500);
await addFirstProduct(0);
console.log('table 3 — total        :', (await total()).trim());
// Table 5 : un autre article
await page.locator('.table-chip', { hasText: 'Table 5' }).click(); await page.waitForTimeout(500);
console.log('table 5 — panier vide  :', (await total()).trim());
await addFirstProduct(1);
console.log('table 5 — total        :', (await total()).trim());
// retour table 3 : l'addition doit être conservée
await page.locator('.table-chip', { hasText: 'Table 3' }).click(); await page.waitForTimeout(600);
console.log('retour table 3         :', (await total()).trim(), '← doit être conservé');
await page.screenshot({ path: `${OUT}/34-tables.png` });
// occupation visible sur la barre
console.log('tables occupées        :', await page.locator('.table-chip.busy').count());
// règlement de la table 3
await page.locator('.btn-checkout').click(); await page.waitForTimeout(600);
console.log('modes de paiement      :', await page.locator('.pay-method').allInnerTexts());
await page.locator('.quick-amounts button').first().click();
await page.locator('.modal-foot button', { hasText: 'Valider la vente' }).click();
await page.waitForTimeout(1300);
await page.locator('.modal-foot button', { hasText: 'Nouvelle vente' }).click();
await page.waitForTimeout(600);
console.log('après règlement, occupées :', await page.locator('.table-chip.busy').count(), '← doit être 1 (table 5)');
await page.screenshot({ path: `${OUT}/35-tables-apres.png` });
console.log('erreurs :', errs.length ? errs.slice(0,3) : 'aucune');
await b.close();
