import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinCoach",
  description: "رفيق عربي هادئ لتعلّم البرمجة خطوة بخطوة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar">
      <body className="bg-[var(--background)]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
