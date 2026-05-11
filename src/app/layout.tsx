import "./globals.css";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import Header from "@/widgets/header/Header";
import Footer from "@/widgets/footer/Footer";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className={montserrat.className}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
