/** Emblème de la maison : couperet et fourchette croisés — boucherie + restaurant.
 *
 * Deux déclinaisons du même dessin :
 *  - `appLogo`    : marque blanche sur pastille ember, pour l'écran et l'onglet ;
 *  - `ticketLogo` : silhouette noire sans fond, pour l'imprimante thermique.
 *
 * Les deux outils pivotent autour d'un point bas (50, 88) et s'écartent de 22° :
 * les manches se croisent en bas, les têtes restent séparées. Superposés au
 * centre, la lame avalait la fourchette et l'ensemble devenait illisible sous
 * 48 px — or c'est la taille utilisée dans le bandeau et le rail.
 *
 * Version ticket : pas de dégradé ni de gris (escpos.ts rastérise puis seuille),
 * pas de grand aplat noir (lent et gourmand en encre sur du thermique), et des
 * dimensions explicites — sans elles un SVG dessiné dans un <canvas> a une
 * taille intrinsèque nulle sous Chrome et ne s'imprimerait pas.
 */

const CLEAVER = `<g transform="rotate(-22 50 88)">
  <path d="M33 14h34a5 5 0 0 1 5 5v27a5 5 0 0 1-5 5H33a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5Z"/>
  <rect x="45.5" y="49" width="9" height="37" rx="4.5"/>
</g>`;

const FORK = `<g transform="rotate(22 50 88)">
  <rect x="42" y="14" width="4" height="20" rx="2"/>
  <rect x="48" y="14" width="4" height="20" rx="2"/>
  <rect x="54" y="14" width="4" height="20" rx="2"/>
  <path d="M40.5 31h19v6a10 10 0 0 1-7 9.5V84a2.5 2.5 0 0 1-5 0V46.5A10 10 0 0 1 40.5 37Z"/>
</g>`;

/** Marque seule, dans un carré de 100×100. */
export const markSvg = CLEAVER + FORK;

/** Écran : marque blanche sur pastille ember. */
export const appLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><linearGradient id="bLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9705f"/><stop offset="1" stop-color="#b0281b"/></linearGradient></defs>
<rect width="128" height="128" rx="30" fill="url(#bLogo)"/>
<g transform="translate(14 14)" fill="#fff">${markSvg}</g>
</svg>`;

/** Ticket : silhouette noire, fond transparent. */
export const ticketLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
<g fill="#000">${markSvg}</g>
</svg>`;

const toDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n\s*/g, ' ').trim())}`;

export const appLogo = toDataUrl(appLogoSvg);
export const ticketLogo = toDataUrl(ticketLogoSvg);
