import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: "Cloudflare Image Uploader",
  description: "Upload and manage images for email blasts and websites using Cloudflare Images",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
