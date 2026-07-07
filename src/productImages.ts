/**
 * Generates a polished illustrated "product shot" as an inline SVG data URL.
 * Used as the visual for products that have no uploaded photo — far richer than
 * a flat gradient, and fully offline/self-contained (no network, no storage).
 * A real uploaded photo always takes precedence over this.
 */

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amount)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amount)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const cache = new Map<string, string>();

export function productImage(emoji: string, color: string): string {
  const key = `${emoji}|${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const light = shade(color, 0.18);
  const dark = shade(color, -0.28);
  const w = 320;
  const h = 180;

  // faint diagonal "marbling" strokes for texture
  let marbling = '';
  for (let i = -2; i < 8; i++) {
    const x = i * 46;
    marbling += `<path d="M ${x} ${h} L ${x + 70} 0" stroke="${shade(color, -0.4)}" stroke-width="8" opacity="0.05" stroke-linecap="round"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.32" cy="0.28" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${marbling}
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <ellipse cx="${w / 2}" cy="${h / 2 + 42}" rx="86" ry="20" fill="#000000" opacity="0.16"/>
  <text x="${w / 2}" y="${h / 2}" font-size="96" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  <rect width="${w}" height="${h}" fill="url(#floor)"/>
</svg>`;

  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}
