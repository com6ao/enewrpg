// Next 15: cookies() é assíncrono
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
