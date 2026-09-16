import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ValueXtract",
  description:
    "Convert agricultural financial information into actionable client value.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-vx-bg text-vx-text antialiased">{children}</body>
    </html>
  );
}
