import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import SessionProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PTCE Analytics",
  description: "PTCE Learner Data Longitudinal Analysis Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <ToastProvider>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto bg-gray-50/50 p-4 lg:p-8">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </div>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
