import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinCoach",
  description: "Week 1 student app shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
