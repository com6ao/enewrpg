"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();
      const isLoggedIn = !!data.session;

      // se não estiver logado e não estiver nas rotas públicas -> manda pro login
      const publicRoutes = ["/login", "/register", "/"];
      if (!isLoggedIn && !publicRoutes.includes(pathname)) {
        router.replace("/login");
      }
    }
    check();
  }, [pathname, router]);

  return <>{children}</>;
}
