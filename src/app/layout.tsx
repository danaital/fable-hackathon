import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Hebrew } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DIRECTION, LOCALE_COOKIE, MODE_COOKIE, parseLocale, parseMode } from "@/lib/prefs";
import { Providers } from "./providers";

const latin = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-latin" });
const hebrew = IBM_Plex_Sans_Hebrew({ subsets: ["hebrew"], weight: ["400", "500"], variable: "--font-hebrew" });

export const metadata: Metadata = { title: "Bahir" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);
  const mode = parseMode(store.get(MODE_COOKIE)?.value);

  return (
    <html lang={locale} dir={DIRECTION[locale]} className={`${latin.variable} ${hebrew.variable}`}>
      <body>
        <Providers initialLocale={locale} initialMode={mode}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
