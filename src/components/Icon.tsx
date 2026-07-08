/** Lightweight inline line-icon set (stroke = currentColor), so the UI uses a
 * consistent outline iconography instead of emojis. 24×24, 2px stroke. */
import type { SVGProps } from 'react';

export type IconName =
  | 'menu' | 'search' | 'bell' | 'grid' | 'settings' | 'users' | 'chart' | 'truck'
  | 'meat' | 'book' | 'basket' | 'trash' | 'cash' | 'barcode' | 'lock' | 'plus'
  | 'chevron' | 'x' | 'edit' | 'coins' | 'refresh' | 'logout' | 'cloud' | 'printer'
  | 'image' | 'check' | 'scale' | 'card' | 'credit' | 'drawer' | 'alert';

const P: Record<IconName, string> = {
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M14 14h6v6h-6z M4 14h6v6H4z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M5 5l2 2 M17 17l2 2 M2 12h3 M19 12h3 M5 19l2-2 M17 7l2-2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  chart: 'M3 3v18h18 M7 15v3 M12 10v8 M17 6v12',
  truck: 'M14 17V6a1 1 0 0 0-1-1H2v12h2 M14 9h4l4 4v3h-2 M9 17h4 M6.5 17.5a1.5 1.5 0 1 0 0 .1z M17.5 17.5a1.5 1.5 0 1 0 0 .1z',
  meat: 'M18.5 5.5a5 5 0 0 0-7 0l-6 6a4 4 0 0 0 5.6 5.6l6-6a5 5 0 0 0 1.4-5.6z M8.5 15.5a1.5 1.5 0 1 0 .1 0z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  basket: 'M5 10h14l-1.2 8.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5z M9 10l3-6 3 6 M9.5 14v3 M14.5 14v3',
  trash: 'M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14 M10 11v6 M14 11v6',
  cash: 'M2 6h20v12H2z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M5.5 12h.01 M18.5 12h.01',
  barcode: 'M4 6v12 M7 6v12 M10.5 6v12 M13 6v12 M16.5 6v12 M20 6v12',
  lock: 'M4 11h16v10H4z M8 11V7a4 4 0 0 1 8 0v4',
  plus: 'M12 5v14 M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  x: 'M18 6 6 18 M6 6l12 12',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  coins: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3z M13.5 6.5a5 5 0 1 1-5 8.7',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8 M21 3v5h-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A3.5 3.5 0 0 0 6.5 19z',
  printer: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  image: 'M3 3h18v18H3z M9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M21 15l-5-5L5 21',
  check: 'M20 6 9 17l-5-5',
  scale: 'M12 3v18 M7 21h10 M6 7h12 M6 7l-3 6a3 3 0 0 0 6 0z M18 7l-3 6a3 3 0 0 0 6 0z',
  card: 'M2 5h20v14H2z M2 10h20',
  credit: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4',
  drawer: 'M3 8h18v12H3z M3 8l2-4h14l2 4 M9 12h6',
  alert: 'M12 3 2 20h20L12 3z M12 9v5 M12 17h.01',
};

export function Icon({ name, size = 22, strokeWidth = 2, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}
