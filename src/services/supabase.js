/**
 * Supabase client (React Native / Expo).
 *
 * Same project as the web app (q-game/src/services/supabase.js) — reads
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY from .env.local.
 * If either is missing, exports `null` so the rest of the app falls back to
 * guest mode without crashing, same convention as the web app.
 *
 * RN-specific differences from the web client:
 *   - `detectSessionInUrl: false` — there's no browser URL to inspect.
 *   - AsyncStorage as the session storage adapter, not localStorage.
 *   - react-native-url-polyfill/auto, imported first: RN's JS engine has no
 *     built-in URL/URLSearchParams, which postgrest-js and realtime-js need.
 */
import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isCloudEnabled = !!supabase;
