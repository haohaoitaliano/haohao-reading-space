import type { Metadata } from "next";
import { AuthProfileProvider } from "@/components/AuthProfileProvider";
import { getAuthContext } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "好好意语共读空间",
  description: "好好意语共读空间 7 天免费公测版",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthContext();

  return (
    <html lang="zh-CN">
      <body>
        <AuthProfileProvider profile={auth?.profile ?? null}>{children}</AuthProfileProvider>
      </body>
    </html>
  );
}
