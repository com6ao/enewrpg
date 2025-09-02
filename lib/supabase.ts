// /lib/supabase.ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  const missing = [] as string[];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const message = `Missing environment variables: ${missing.join(", ")}. Ensure they are defined in your .env file.`;
  console.error(message);
  throw new Error(message);
}

export const supabase = createBrowserClient(url, anonKey);
