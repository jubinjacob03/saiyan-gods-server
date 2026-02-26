"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBotStatus } from "@/lib/bot-api";
import { createClient } from "@/lib/supabase";
import { motion } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const [stats, setStats] = useState({
    totalSounds: 0,
    botStatus: "offline",
    guilds: 0,
    activeVoice: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from("sounds")
        .select("*", { count: "exact", head: true });

      try {
        const botStatus = await getBotStatus();
        setStats({
          totalSounds: count || 0,
          botStatus: "online",
          guilds: botStatus.data?.totalGuilds || 0,
          activeVoice: botStatus.data?.activeVoiceConnections || 0,
        });
      } catch {
        setStats((prev) => ({
          ...prev,
          totalSounds: count || 0,
          botStatus: "offline",
        }));
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className={designTokens.spacing.pageSection}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className={`${designTokens.typography.h1} mb-3`}>Dashboard</h1>
          <p className={designTokens.typography.bodyMuted}>
            Overview of your audio management system
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={`grid ${designTokens.spacing.cardGap} md:grid-cols-2 lg:grid-cols-4`}
        >
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={
                        designTokens.icons.md +
                        " " +
                        designTokens.iconColors.blue
                      }
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
                  </div>
                  <CardTitle
                    className={
                      designTokens.typography.h3 + " text-muted-foreground"
                    }
                  >
                    Total Sounds
                  </CardTitle>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={designTokens.typography.h2}
                >
                  {loading ? "—" : stats.totalSounds}
                </motion.div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  in your library
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${stats.botStatus === "online" ? designTokens.iconBackgrounds.green : designTokens.iconBackgrounds.red}`}
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${stats.botStatus === "online" ? "bg-green-500" : "bg-red-500"}`}
                    />
                  </div>
                  <CardTitle
                    className={
                      designTokens.typography.h3 + " text-muted-foreground"
                    }
                  >
                    Bot Status
                  </CardTitle>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className={`${designTokens.typography.h2} capitalize`}
                >
                  {stats.botStatus}
                </motion.div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  connection state
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.purple}`}
                  >
                    <svg
                      className={
                        designTokens.icons.md +
                        " " +
                        designTokens.iconColors.purple
                      }
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={
                      designTokens.typography.h3 + " text-muted-foreground"
                    }
                  >
                    Servers
                  </CardTitle>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={designTokens.typography.h2}
                >
                  {stats.guilds}
                </motion.div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  connected
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                  >
                    <svg
                      className={
                        designTokens.icons.md +
                        " " +
                        designTokens.iconColors.orange
                      }
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={
                      designTokens.typography.h3 + " text-muted-foreground"
                    }
                  >
                    Active Voice
                  </CardTitle>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className={designTokens.typography.h2}
                >
                  {stats.activeVoice}
                </motion.div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  connections
                </p>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`grid md:grid-cols-2 ${designTokens.spacing.cardGap}`}
        >
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card
              className={`cursor-pointer ${designTokens.cards.default} h-full`}
              onClick={() => (window.location.href = "/upload")}
            >
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.primary}`}
                  >
                    <svg
                      className={
                        designTokens.icons.md +
                        " " +
                        designTokens.iconColors.primary
                      }
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <CardTitle className={designTokens.typography.h3}>
                    Upload Sound
                  </CardTitle>
                </div>
                <CardDescription className={designTokens.typography.small}>
                  Add new audio files to your library
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card
              className={`cursor-pointer ${designTokens.cards.default} h-full`}
              onClick={() => (window.location.href = "/sounds")}
            >
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={
                        designTokens.icons.md +
                        " " +
                        designTokens.iconColors.blue
                      }
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <CardTitle className={designTokens.typography.h3}>
                    Browse Library
                  </CardTitle>
                </div>
                <CardDescription className={designTokens.typography.small}>
                  View and play all your sounds
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
