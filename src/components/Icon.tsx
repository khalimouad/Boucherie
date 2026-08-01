/** Flat (filled) modern icon set. Single-color glyphs using fill=currentColor,
 * so icons inherit text color and read as solid modern shapes. 24×24. */
import type { CSSProperties } from 'react';

export type IconName =
  | 'menu' | 'search' | 'bell' | 'grid' | 'settings' | 'users' | 'chart' | 'truck'
  | 'meat' | 'book' | 'basket' | 'trash' | 'cash' | 'barcode' | 'lock' | 'plus'
  | 'chevron' | 'x' | 'edit' | 'coins' | 'refresh' | 'logout' | 'cloud' | 'printer'
  | 'image' | 'check' | 'scale' | 'card' | 'credit' | 'drawer' | 'alert'
  | 'sun' | 'moon' | 'monitor' | 'dots' | 'camera';

const G: Record<IconName, string> = {
  menu: '<rect x="3" y="5" width="18" height="2.6" rx="1.3"/><rect x="3" y="10.7" width="18" height="2.6" rx="1.3"/><rect x="3" y="16.4" width="18" height="2.6" rx="1.3"/>',
  search: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l3.74 3.75a1 1 0 0 0 1.42-1.42l-3.75-3.74A7.5 7.5 0 0 0 10.5 3Zm-5.5 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"/>',
  bell: '<path d="M12 2a1.5 1.5 0 0 0-1.5 1.5v.67A6 6 0 0 0 6 10c0 3.6-1 5-1.9 6.1A1.2 1.2 0 0 0 5 18h14a1.2 1.2 0 0 0 .9-1.9C19 15 18 13.6 18 10a6 6 0 0 0-4.5-5.83V3.5A1.5 1.5 0 0 0 12 2Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0h-5Z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  settings: '<path fill-rule="evenodd" clip-rule="evenodd" d="M11.08 2.25c-.92 0-1.7.66-1.85 1.57l-.09.52c-.02.12-.11.26-.3.35-.34.16-.67.35-.98.57-.17.11-.34.12-.45.08l-1.02-.38a1.87 1.87 0 0 0-2.28.82l-.92 1.6a1.87 1.87 0 0 0 .43 2.38l.84.7c.1.07.17.22.16.43a7.6 7.6 0 0 0 0 1.14c.01.2-.06.35-.16.43l-.84.69a1.87 1.87 0 0 0-.43 2.38l.92 1.6c.5.86 1.5 1.2 2.28.82l1.02-.38c.11-.05.28-.04.45.08.31.21.64.4.98.57.19.09.28.23.3.35l.18 1.07c.15.9.93 1.57 1.85 1.57h1.84c.92 0 1.7-.66 1.85-1.57l.18-1.07c.02-.12.11-.26.3-.35.34-.16.67-.36.98-.57.17-.11.34-.13.45-.08l1.02.38c.79.3 1.79-.04 2.28-.82l.92-1.6a1.87 1.87 0 0 0-.43-2.38l-.84-.69c-.1-.08-.17-.23-.16-.43a7.6 7.6 0 0 0 0-1.14c-.01-.2.06-.35.16-.43l.84-.7c.7-.58.89-1.59.43-2.38l-.92-1.6a1.87 1.87 0 0 0-2.28-.82l-1.02.38c-.11.04-.28.03-.45-.08a7.5 7.5 0 0 0-.98-.57c-.19-.09-.28-.23-.3-.35l-.18-1.07a1.87 1.87 0 0 0-1.85-1.57h-1.84ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"/>',
  users: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.5c-3.3 0-6 1.8-6 4.2V19h12v-2.3c0-2.4-2.7-4.2-6-4.2Z"/><path d="M16.5 11a3 3 0 1 0-1.7-5.47A5 5 0 0 1 16 9c0 .78-.18 1.52-.5 2.18.32.14.66.22 1 .22Z"/><path d="M17 12.5c-.5 0-1 .05-1.46.15A5.9 5.9 0 0 1 16.5 16.7V19H21v-1.8c0-2.2-1.9-3.7-4-3.7Z"/>',
  chart: '<rect x="3" y="12" width="4" height="8" rx="1.2"/><rect x="10" y="6" width="4" height="14" rx="1.2"/><rect x="17" y="15" width="4" height="5" rx="1.2"/>',
  truck: '<path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h9A1.5 1.5 0 0 1 14 6.5V8h3.2c.5 0 .95.24 1.24.64l2.3 3.16c.17.24.26.52.26.82V16.5a1.5 1.5 0 0 1-1.5 1.5H18a2.5 2.5 0 0 1-5 0H9a2.5 2.5 0 0 1-5 0H3.5A1.5 1.5 0 0 1 2 16.5v-10Z"/>',
  meat: '<path fill-rule="evenodd" clip-rule="evenodd" d="M17.7 4.3c-2.6-2.6-7-2.4-9.6.2L4.6 8c-2 2-2.06 5.2-.16 7.26.86.93 2 1.46 3.18 1.6.14 1.16.68 2.28 1.6 3.14C11.3 21.9 14.5 21.84 16.5 19.84l3.5-3.5c2.6-2.6 2.4-7.03-.3-9.64l-2-2Zm-8.7 12a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>',
  book: '<path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a1 1 0 0 1-1.5.87L12 18.5l-5.5 2.37A1 1 0 0 1 5 20V4Z"/>',
  basket: '<path d="M8.6 3.2a1 1 0 0 1 1.5.1L12.5 6h.02L14.9 3.3a1 1 0 1 1 1.5 1.32L15.2 6h2.3a1 1 0 0 1 0 2h-11a1 1 0 0 1 0-2h2.3L8.5 4.6a1 1 0 0 1 .1-1.4ZM4 10h16l-1.1 8.2A2 2 0 0 1 16.9 20H7.1a2 2 0 0 1-2-1.8L4 10Zm5 3a1 1 0 0 0-2 0v3a1 1 0 1 0 2 0v-3Zm4 0a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0v-3Zm4 0a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0v-3Z"/>',
  trash: '<path d="M9 2a1 1 0 0 0-1 1v1H4a1 1 0 0 0 0 2h16a1 1 0 1 0 0-2h-4V3a1 1 0 0 0-1-1H9Z"/><path d="M6 8h12l-.87 12.14A2 2 0 0 1 15.14 22H8.86a2 2 0 0 1-1.99-1.86L6 8Zm4 3a1 1 0 0 0-2 0v6a1 1 0 1 0 2 0v-6Zm6 0a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Z"/>',
  cash: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 7a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Zm10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>',
  barcode: '<rect x="3" y="5" width="1.7" height="14" rx=".7"/><rect x="6.2" y="5" width="1" height="14" rx=".5"/><rect x="8.6" y="5" width="2.1" height="14" rx=".7"/><rect x="12.2" y="5" width="1" height="14" rx=".5"/><rect x="14.6" y="5" width="2.2" height="14" rx=".7"/><rect x="18.2" y="5" width="1" height="14" rx=".5"/><rect x="20.3" y="5" width="1" height="14" rx=".5"/>',
  lock: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6 9V8a6 6 0 1 1 12 0v1h.5A1.5 1.5 0 0 1 20 10.5v9A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-9A1.5 1.5 0 0 1 5.5 9H6Zm2 0h8V8a4 4 0 0 0-8 0v1Zm4 4.5a1.5 1.5 0 0 0-1 2.6V18a1 1 0 1 0 2 0v-1.9a1.5 1.5 0 0 0-1-2.6Z"/>',
  plus: '<path d="M11 4a1 1 0 1 1 2 0v7h7a1 1 0 1 1 0 2h-7v7a1 1 0 1 1-2 0v-7H4a1 1 0 1 1 0-2h7V4Z"/>',
  chevron: '<path d="M9.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4Z"/>',
  x: '<path d="M6.4 5A1 1 0 0 0 5 6.4l5.6 5.6L5 17.6A1 1 0 1 0 6.4 19l5.6-5.6 5.6 5.6a1 1 0 0 0 1.4-1.4L13.4 12 19 6.4A1 1 0 0 0 17.6 5L12 10.6 6.4 5Z"/>',
  edit: '<path d="M14.06 6.19l3.75 3.75L8.5 19.25l-4.02.83a.6.6 0 0 1-.71-.71l.83-4.02 9.46-9.16Zm5.16-1.16a2.12 2.12 0 0 1 0 3l-.9.9-3.75-3.75.9-.9a2.12 2.12 0 0 1 3 0l.75.75Z"/>',
  coins: '<path d="M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>',
  refresh: '<path d="M12 6V3.2c0-.5-.6-.7-.9-.4L7.3 6.4a.6.6 0 0 0 0 .9l3.8 3.6c.3.3.9.1.9-.4V8a4 4 0 1 1-4 4H5a6 6 0 1 0 7-6Z"/>',
  logout: '<path d="M10 3a1 1 0 0 1 0 2H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h4Z"/><path d="M16.3 7.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L18.6 13H10a1 1 0 1 1 0-2h8.6l-2.3-2.3a1 1 0 0 1 0-1.4Z"/>',
  cloud: '<path d="M7 19a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 10.5a4.5 4.5 0 0 1-.5 8.5H7Z"/>',
  printer: '<path d="M7 3a1 1 0 0 0-1 1v4h12V4a1 1 0 0 0-1-1H7Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M4 9a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3h2a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H4Zm4 8h8v3H8v-3Z"/>',
  image: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4Zm4.5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 18l4.2-5 3 3.6L15 13.5 19 18H5Z"/>',
  check: '<path d="M20.3 6.3a1 1 0 0 1 0 1.4l-10 10a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l4.3 4.3 9.3-9.3a1 1 0 0 1 1.4 0Z"/>',
  scale: '<path d="M12 2a1 1 0 0 1 1 1v1.1l5.8 1.2a1 1 0 1 1-.4 1.96L13 6.14V19h4a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h4V6.14L5.6 7.26A1 1 0 1 1 5.2 5.3L11 4.1V3a1 1 0 0 1 1-1Z"/><path d="M6 8l-3.2 6h6.4L6 8Zm12 0l-3.2 6h6.4L18 8Z"/>',
  card: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 5a2 2 0 0 0-2 2v1h20V7a2 2 0 0 0-2-2H4Zm18 5H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7ZM5 15a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"/>',
  credit: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 5a2 2 0 0 0-2 2v1h20V7a2 2 0 0 0-2-2H4Zm18 5H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7ZM5 15a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"/>',
  drawer: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 4h16a1 1 0 0 1 .9.55l1.8 3.6c.2.14.3.3.3.55V18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8.7c0-.25.1-.41.3-.55l1.8-3.6A1 1 0 0 1 4 4Zm5 8a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Z"/>',
  alert: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.9 3.6a1.25 1.25 0 0 1 2.2 0l8.5 15A1.25 1.25 0 0 1 20.5 20.5h-17A1.25 1.25 0 0 1 2.4 18.6l8.5-15ZM12 8a1 1 0 0 0-1 1v3.5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm0 8.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"/>',
  sun: '<path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/><path d="M12 1.5a1 1 0 0 1 1 1V4a1 1 0 1 1-2 0V2.5a1 1 0 0 1 1-1Zm0 17a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V19.5a1 1 0 0 1 1-1ZM22.5 12a1 1 0 0 1-1 1H20a1 1 0 1 1 0-2h1.5a1 1 0 0 1 1 1Zm-17 0a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1.5a1 1 0 0 1 1 1Zm13.9-6.4a1 1 0 0 1 0 1.42l-1.06 1.06a1 1 0 0 1-1.42-1.42l1.07-1.06a1 1 0 0 1 1.41 0ZM7.08 15.5a1 1 0 0 1 0 1.42l-1.06 1.06a1 1 0 1 1-1.42-1.42l1.06-1.06a1 1 0 0 1 1.42 0Zm11.34 1.06a1 1 0 0 1-1.42 1.42l-1.06-1.06a1 1 0 0 1 1.42-1.42l1.06 1.06ZM7.08 8.5a1 1 0 0 1-1.42 0L4.6 7.44a1 1 0 0 1 1.42-1.42l1.06 1.07a1 1 0 0 1 0 1.41Z"/>',
  moon: '<path d="M20.7 14.1a1 1 0 0 0-1.2-1.3 6.6 6.6 0 0 1-8.3-8.3 1 1 0 0 0-1.3-1.2A8.9 8.9 0 1 0 20.7 14.1Z"/>',
  monitor: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h6v2H7a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2h-2v-2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3Zm10 13h-2v2h2v-2Z"/>',
  dots: '<path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  camera: '<path fill-rule="evenodd" clip-rule="evenodd" d="M9.5 3a2 2 0 0 0-1.66.89L7.1 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.1l-.74-1.11A2 2 0 0 0 14.5 3h-5Zm2.5 5.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>',
};

export function Icon({ name, size = 22, className, style, title }: { name: IconName; size?: number; className?: string; style?: CSSProperties; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: G[name] }}
    />
  );
}
