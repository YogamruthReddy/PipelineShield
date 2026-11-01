import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { FontProvider } from "@/lib/font-theme";

export const metadata: Metadata = {
  title: "PipelineShield | Automated DevSecOps Gatekeeper",
  description:
    "Automated vulnerability scanning, static code analysis, dependency security checks, and policy enforcement for GitHub CI/CD pipelines.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/shield-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-teal-200 selection:text-teal-950 dark:selection:bg-teal-900 dark:selection:text-teal-100">
        <FontProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </FontProvider>
      </body>
    </html>
  );
}
