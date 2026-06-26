import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SidebarNav from "@/components/SidebarNav.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "YouTube Shorts AutoPoster - Quản Lý Kênh & Đăng Clip Tự Động",
  description: "Hệ thống quản lý và tự động đăng video YouTube Shorts chuyên nghiệp.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="main-layout">
          <SidebarNav />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
