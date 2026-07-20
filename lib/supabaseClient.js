// lib/supabaseClient.js
//
// Setup:
//   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
//
// Create a project at supabase.com, then in Project Settings > API grab
// your URL and anon key and put them in a .env file (use expo-env or
// EXPO_PUBLIC_ prefix so they're available at build time):
//
//   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//
// Never commit the service_role key to the app — only the anon key,
// which is safe client-side because Row Level Security enforces access.

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
