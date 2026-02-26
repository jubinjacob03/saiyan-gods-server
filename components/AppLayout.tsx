"use client";

import { Sidebar } from "@/components/Sidebar";
import { motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-br from-background via-background to-muted/20">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 overflow-y-auto p-8 lg:p-12"
      >
        <div className="max-w-7xl mx-auto">{children}</div>
      </motion.main>
    </div>
  );
}
