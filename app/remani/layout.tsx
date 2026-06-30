import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NexFlix",
  description: "Watch Party",
};

export default function RemaniLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.className} bg-[#141414] text-white antialiased min-h-screen`}>
      {children}
    </div>
  );
}
