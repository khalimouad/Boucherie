import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/* Cloud endpoint of the shop, resolved at build time.
 *
 * Vercel's Supabase integration injects SUPABASE_URL / SUPABASE_ANON_KEY into
 * the build environment without a VITE_ prefix, so Vite would not expose them
 * to the client on its own — they are inlined here instead.
 *
 * ONLY the publishable / anon key may go through here. This app has no server:
 * anything inlined ends up readable in the browser bundle. SUPABASE_SERVICE_
 * ROLE_KEY and POSTGRES_URL — also injected by that integration — bypass Row
 * Level Security and must never be referenced below.
 */
const FALLBACK = {
  url: 'https://nkqlwcjgvxkhxhmnrpfc.supabase.co',
  key: 'sb_publishable_UhGqkbZO4LFihxJcquAEUg_BOy3gcaO',
  email: 'uncmou+caisse@gmail.com',
};

export default defineConfig(({ mode }) => {
  // '' = no prefix filter, so .env files and the CI environment are both read
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  // L'intégration Supabase de Vercel pose SUPABASE_* et parfois NEXT_PUBLIC_* :
  // on accepte les trois graphies pour que le déploiement fonctionne sans
  // recopier manuellement les variables.
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK.url;
  const key =
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK.key;
  const email = env.VITE_CLOUD_EMAIL || env.CLOUD_EMAIL || FALLBACK.email;

  // Printed on every build so a misconfigured deployment is obvious in the logs
  // instead of silently syncing to the wrong shop.
  console.log(`[boucherie] Supabase → ${url}${url === FALLBACK.url ? '  (valeur par défaut)' : '  (variable d\'environnement)'}`);

  return {
    plugins: [react()],
    server: { host: true, port: 5173 },
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      __SUPABASE_KEY__: JSON.stringify(key),
      __CLOUD_EMAIL__: JSON.stringify(email),
    },
  };
});
