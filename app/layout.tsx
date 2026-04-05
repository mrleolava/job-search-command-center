import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Job Search Command Center",
  description: "Personal job search tracking and pipeline management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-claude-bg">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
