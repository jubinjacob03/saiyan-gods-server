"use client";

import { Inter } from "next/font/google";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const inter = Inter({ subsets: ["latin"] });

export default function NexkordMoviesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`${inter.className} bg-[#141414] text-white antialiased min-h-screen relative`}>
      <button 
        className="fixed top-4 left-4 z-[60] p-2 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-md transition-colors md:hidden border border-white/10"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      {/* Show button on desktop as well since forceOverlay removes static positioning */}
      <button 
        className="hidden md:flex fixed top-4 left-4 z-[60] p-2 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-md transition-colors border border-white/10"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="w-6 h-6 text-white" />
      </button>

      <Sidebar 
        mobileOpen={sidebarOpen} 
        setMobileOpen={setSidebarOpen} 
        forceOverlay={true} 
      />

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}
