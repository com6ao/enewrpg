import type { Metadata } from "next";
import "./globals.css";
import Nav from "./Nav";
// ❌ não importe o supabase aqui

export const metadata: Metadata = {
  title: "enewRPG",
  description: "RPG online",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <header className="site-header">
          <div className="container"><Nav /></div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
