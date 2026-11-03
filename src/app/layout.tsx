import type { Metadata, Viewport } from "next";
import { AuthProfileProvider } from "@/components/AuthProfileProvider";
import { AudioPlaybackCoordinator } from "@/components/AudioPlaybackCoordinator";
import { getAuthContext } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "好好意语共读空间",
  description: "好好意语共读空间 7 天免费公测版",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "好好意语",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#19caad",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthContext();

  return (
    <html lang="zh-CN">
      <body>
        <AudioPlaybackCoordinator />
        <AuthProfileProvider profile={auth?.profile ?? null}>{children}</AuthProfileProvider>
      </body>
    </html>
  );
}
