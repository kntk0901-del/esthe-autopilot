import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Esthe Growth Autopilot",
    template: "%s | Esthe Growth Autopilot",
  },
  description: "3店舗の出勤、投稿、売上分析をまとめる運用PoC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
