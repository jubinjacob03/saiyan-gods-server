"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getSession, signOut } from "@/lib/auth";
import type { Session } from "@supabase/supabase-js";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: "Admin",
    href: "/admin",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    name: "Sounds",
    href: "/sounds",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  },
  {
    name: "Private VC",
    href: "/private-vc",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072M12 18.364V5.636M8.464 8.464a5 5 0 000 7.072"
        />
      </svg>
    ),
  },
  {
    name: "Music",
    href: "/music",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 18v-6a9 9 0 0118 0v6M3 18a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5zm16 0a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z"
        />
      </svg>
    ),
  },
  {
    name: "Settings",
    href: "/settings",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export function Sidebar({
  mobileOpen = false,
  setMobileOpen,
}: {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    const currentSession = await getSession();
    setSession(currentSession);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div
      className={[
        "flex h-full w-72 shrink-0 flex-col border-r bg-linear-to-b from-card to-card/50 shadow-lg",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
        "md:static md:z-auto md:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      ].join(" ")}
    >
      {/* Mobile close button */}
      <div className="flex items-center justify-between md:hidden px-4 pt-3 pb-1">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          Menu
        </span>
        <button
          onClick={() => setMobileOpen?.(false)}
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
          aria-label="Close menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex h-20 items-center justify-center border-b px-6 bg-linear-to-r from-primary/10 to-primary/5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <Image
            src="/LOGO.jpeg"
            alt="Saiyan Gods"
            width={44}
            height={44}
            className="rounded-full ring-2 ring-primary/30 object-cover"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Saiyan Gods</h1>
            <p className="text-xs text-muted-foreground">Server Dashboard</p>
          </div>
        </motion.div>
      </div>

      <nav className="flex-1 space-y-2 p-6">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Link
                href={item.href}
                onClick={() => setMobileOpen?.(false)}
                className={cn(
                  "group flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-300",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/50 scale-105"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-105",
                )}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  {item.icon}
                </motion.div>
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto h-2 w-2 rounded-full bg-primary-foreground"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="border-t p-6"
      >
        {session?.user ? (
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-3 rounded-xl bg-linear-to-r from-primary/10 to-primary/5 px-4 py-3.5 border border-primary/20 hover:border-primary/40 transition-colors"
            >
              <div className="relative">
                <img
                  src={
                    session.user.user_metadata?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`
                  }
                  alt="Avatar"
                  className="h-10 w-10 rounded-full ring-2 ring-primary/20"
                />
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold truncate">
                  {session.user.user_metadata?.full_name ||
                    session.user.user_metadata?.username ||
                    "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session.user.email || "Discord User"}
                </p>
              </div>
              <motion.svg
                animate={{ rotate: showDropdown ? 180 : 0 }}
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </motion.svg>
            </motion.button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-xl shadow-xl overflow-hidden"
                >
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-xl bg-linear-to-r from-green-500/10 to-emerald-500/10 px-4 py-3.5 border border-green-500/20">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="h-3 w-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">System Online</p>
              <p className="text-xs text-muted-foreground">
                All services running
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
