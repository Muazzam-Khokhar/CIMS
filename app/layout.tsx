import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/confirm-provider";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
// import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "CIMS",
  description: "Car Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* <LanguageProvider></LanguageProvider> */}
        <ConfirmProvider>{children}</ConfirmProvider>

        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}