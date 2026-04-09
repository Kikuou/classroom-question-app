import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "授業質問アプリ",
  description: "授業中の質問を集約・管理するアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
