"use client";

import { supabase } from "./supabase";

export async function logout() {
  await supabase.auth.signOut();
  location.href = "/login";
}
