"use client";

import { Sidebar } from "@/components/Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setTheme } = useTheme();

  // Restore per-user theme preference from localStorage on every page load
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const id =
        user.identities?.find((i) => i.provider === "discord")?.identity_data
          ?.sub || user.id;
      const saved = localStorage.getItem(`theme_${id}`);
      if (saved) setTheme(saved);
    });
  }, [setTheme]);

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-br from-background via-background to-muted/20">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 lg:p-12"
      >
        {/* Mobile top bar — hamburger + logo, hidden on md+ */}
        <div className="flex items-center gap-3 mb-5 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <Image
              src="/LOGO.jpeg"
              alt="Saiyan Gods"
              width={34}
              height={34}
              className="rounded-full object-cover"
            />
            <span className="font-bold text-base tracking-tight">
              Saiyan Gods
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto">{children}</div>
      </motion.main>
    </div>
  );
}
