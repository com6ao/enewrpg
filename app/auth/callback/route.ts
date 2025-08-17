// app/auth/callback/route.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; // ou createRouteHandlerClient, ambos aceitam o mesmo adapter novo

const cookieStore = cookies();

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...(options || {}) });
      },
      delete(name, options) {
        cookieStore.delete({ name, ...(options || {}) });
      },
    },
  }
);
