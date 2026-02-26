"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase";

const MODERATOR_ROLE_ID = "1473075468088377349";
const MANAGER_ROLE_ID = "1473075468088377350";
const OWNER_ROLE_ID = "1473075468088377352";

const ELEVATED_ROLES = new Set([
  MODERATOR_ROLE_ID,
  MANAGER_ROLE_ID,
  OWNER_ROLE_ID,
]);

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AdminPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState<boolean | null>(null); // null = loading
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const checkRole = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/bot/members?userId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        const roleIds: string[] = json.data?.roleIds ?? [];
        setIsModerator(roleIds.some((r) => ELEVATED_ROLES.has(r)));
      } else {
        setIsModerator(false);
      }
    } catch {
      setIsModerator(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const discordId =
          user.identities?.find((i) => i.provider === "discord")
            ?.identity_data?.sub ||
          user.user_metadata?.provider_id ||
          user.id;
        setCurrentUserId(discordId);
        checkRole(discordId);
      }
    });
  }, [checkRole]);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      const res = await fetch("/api/bot/admin/refresh", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        showToast("Status message refreshed!");
      } else {
        showToast(json.error || "Failed to refresh", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleSetupVerification = async () => {
    if (!isModerator) return;
    setSetupLoading(true);
    try {
      const res = await fetch("/api/bot/admin/setup-verification", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Verification embeds posted!");
      } else {
        showToast(json.error || "Failed to setup verification", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSetupLoading(false);
    }
  };

  const isRoleLoading = isModerator === null;

  return (
    <AppLayout>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-500/90 text-white"
                : "bg-red-500/90 text-white"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className={designTokens.typography.h1}>Admin</h1>
          <p className="text-muted-foreground mt-1">
            Server management actions · Role-restricted functions are noted
            below
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Refresh Status */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.blue}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Refresh Status</CardTitle>
                    <CardDescription className="mt-0.5">
                      Open to all members
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Manually force-updates the bot&apos;s status embed in the
                  server. Use this if the status message looks out of date or
                  stuck.
                </p>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshLoading}
                  className="w-full"
                >
                  {refreshLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg
                        className={`${designTokens.icons.sm} mr-1.5`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh Status Message
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Setup Verification */}
          <motion.div variants={item}>
            <Card
              className={`h-full ${!isRoleLoading && !isModerator ? "opacity-70" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`${designTokens.iconContainer} ${
                      isModerator
                        ? designTokens.iconBackgrounds.purple
                        : designTokens.iconBackgrounds.muted
                    }`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${
                        isModerator
                          ? "text-purple-500"
                          : "text-muted-foreground"
                      }`}
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
                  </div>
                  <div>
                    <CardTitle>Setup Verification</CardTitle>
                    <CardDescription className="mt-0.5">
                      Moderator+ only
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Re-posts the verification embed with buttons in the
                  designated channel. Use when the verification message is
                  missing or needs to be refreshed.
                </p>

                {!isRoleLoading && !isModerator && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <svg
                      className="w-3.5 h-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Requires Moderator or higher role
                  </div>
                )}

                <Button
                  onClick={handleSetupVerification}
                  disabled={setupLoading || isRoleLoading || !isModerator}
                  variant={isModerator ? "default" : "outline"}
                  className="w-full"
                >
                  {isRoleLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Checking permissions...
                    </>
                  ) : setupLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <svg
                        className={`${designTokens.icons.sm} mr-1.5`}
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
                      Post Verification Embed
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Role indicator */}
        {!isRoleLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                className={`w-2 h-2 rounded-full ${isModerator ? "bg-green-500" : "bg-gray-400"}`}
              />
              {isModerator
                ? "You have elevated permissions (Moderator+)"
                : "You have standard member permissions"}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
