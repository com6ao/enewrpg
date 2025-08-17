import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./Nav";
import AuthGuard from "@/components/AuthGuard";         // << NOVO
import { supabase } from "@/lib/supabase";

supabase.auth.getSession(); // sincronizar sessão logo no boot

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "enewRPG",
  description: "RPG online",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="site-header">
          <div className="container"><Nav /></div>
        </header>
        {/* Protege todas as rotas abaixo */}
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
