import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lens — Market Heat Map",
  description: "Custom stock and index performance heat maps with liquid-glass UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0, overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
