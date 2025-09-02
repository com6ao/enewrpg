// Next 15: cookies() é assíncrono
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (pairs: { name: string; value: string; options?: any }[]) => {
          pairs.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...(options ?? {}) })
          );
        },
      },
    }
  );
}
