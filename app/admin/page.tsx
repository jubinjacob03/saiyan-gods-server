"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase";
import { BotSocket } from "@/lib/bot-socket";

const MODERATOR_ROLE_ID = "1473075468088377349";
const MANAGER_ROLE_ID = "1473075468088377350";
const OWNER_ROLE_ID = "1473075468088377352";

const ELEVATED_ROLES = new Set([
  MODERATOR_ROLE_ID,
  MANAGER_ROLE_ID,
  OWNER_ROLE_ID,
]);

interface PendingRequest {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  requestedRole: string;
  requestedRoleId: string;
  timestamp: string;
}

interface UserStatus {
  hasFriends: boolean;
  hasMember: boolean;
  hasPending: boolean;
  pendingRole: string | null;
}

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
  const [isModerator, setIsModerator] = useState<boolean | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [approveModal, setApproveModal] = useState<{
    userId: string;
    username: string;
    requestedRole: string;
  } | null>(null);
  const [nickname, setNickname] = useState("");

  const [refreshLoading, setRefreshLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const botSocket = useRef<BotSocket | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUserStatus = useCallback(async (userId: string) => {
    try {
      const res = await fetch(
        `/api/bot/verification/user-status?userId=${userId}`,
      );
      if (res.ok) {
        const json = await res.json();
        setUserStatus(json.data ?? json);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/verification/pending");
      if (res.ok) {
        const json = await res.json();
        setPendingRequests(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      // silent
    }
  }, []);

  const checkRole = useCallback(
    async (userId: string) => {
      try {
        const res = await fetch(`/api/bot/members?userId=${userId}`);
        if (res.ok) {
          const json = await res.json();
          const roleIds: string[] = json.data?.roleIds ?? [];
          const isMod = roleIds.some((r) => ELEVATED_ROLES.has(r));
          setIsModerator(isMod);
          if (isMod) fetchPendingRequests();
        } else {
          setIsModerator(false);
        }
      } catch {
        setIsModerator(false);
      }
    },
    [fetchPendingRequests],
  );

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
        fetchUserStatus(discordId);
      }
    });
  }, [checkRole, fetchUserStatus]);

  useEffect(() => {
    const socket = new BotSocket();
    botSocket.current = socket;

    const handler = (data: unknown) => {
      if (Array.isArray(data)) {
        setPendingRequests(data as PendingRequest[]);
      }
    };

    socket.connect().catch(() => {});
    socket.on("verification_update", handler);

    return () => {
      socket.off("verification_update", handler);
      socket.disconnect();
      botSocket.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isModerator || !currentUserId) return;
    const interval = setInterval(() => {
      fetchPendingRequests();
      fetchUserStatus(currentUserId);
    }, 30000);
    return () => clearInterval(interval);
  }, [isModerator, currentUserId, fetchPendingRequests, fetchUserStatus]);

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

  const handleApply = async (type: "friends" | "member") => {
    if (!currentUserId) return;
    setApplyLoading(type);
    try {
      const res = await fetch("/api/bot/verification/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, type }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(
          `Application submitted! Await moderator approval.`,
        );
        await fetchUserStatus(currentUserId);
      } else {
        showToast(json.error || "Failed to apply", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setApplyLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!approveModal || !currentUserId) return;
    setApproveLoading(approveModal.userId);
    try {
      const res = await fetch("/api/bot/verification/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: currentUserId,
          targetUserId: approveModal.userId,
          nickname: nickname.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(`Approved ${approveModal.username}!`);
        setApproveModal(null);
        setNickname("");
      } else {
        showToast(json.error || "Failed to approve", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setApproveLoading(null);
    }
  };

  const handleReject = async (userId: string, username: string) => {
    if (!currentUserId) return;
    setRejectLoading(userId);
    try {
      const res = await fetch("/api/bot/verification/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: currentUserId,
          targetUserId: userId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(`Rejected ${username}.`);
      } else {
        showToast(json.error || "Failed to reject", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setRejectLoading(null);
    }
  };

  const isRoleLoading = isModerator === null;
  const isMemberRole =
    approveModal?.requestedRole?.toLowerCase().includes("member");

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

      {/* Approve Modal */}
      <AnimatePresence>
        {approveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setApproveModal(null);
              setNickname("");
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="font-semibold text-lg">
                  Approve {approveModal.username}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Role:{" "}
                  <span className="font-medium text-foreground">
                    {approveModal.requestedRole}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nickname{isMemberRole ? " (God prefix will be added)" : ""}
                </label>
                <Input
                  placeholder={
                    isMemberRole ? "Enter name (e.g. Shadow)" : "Enter nickname"
                  }
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApprove()}
                />
                {isMemberRole && nickname.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Final nickname:{" "}
                    <span className="text-foreground font-medium">
                      God {nickname.trim()}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setApproveModal(null);
                    setNickname("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={!!approveLoading}
                >
                  {approveLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Approve"
                  )}
                </Button>
              </div>
            </motion.div>
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
          {/* Card 1 — Refresh Status */}
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

          {/* Card 2 — Setup Verification */}
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
                  Re-posts the verification embed with buttons in the designated
                  channel. Use when the verification message is missing or needs
                  to be refreshed.
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

          {/* Card 3 — Verification (all members) */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.green}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.green}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Verification</CardTitle>
                    <CardDescription className="mt-0.5">
                      Apply for a server role
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {userStatus === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    Loading your status...
                  </div>
                ) : userStatus.hasMember ? (
                  <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        You are a verified Member
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Full server access granted
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {userStatus.hasPending ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                          Pending {userStatus.pendingRole} request
                        </span>
                        <span className="text-muted-foreground">
                          — awaiting moderator approval
                        </span>
                      </div>
                    ) : null}

                    {!userStatus.hasFriends && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Apply for the{" "}
                          <span className="font-medium text-foreground">
                            Friends
                          </span>{" "}
                          role to get basic access to the server.
                        </p>
                        <Button
                          onClick={() => handleApply("friends")}
                          disabled={
                            !!applyLoading ||
                            userStatus.hasPending
                          }
                          className="w-full"
                        >
                          {applyLoading === "friends" ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Submitting...
                            </>
                          ) : (
                            "Apply for Friends"
                          )}
                        </Button>
                      </div>
                    )}

                    {userStatus.hasFriends && !userStatus.hasMember && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          You have Friends role. Apply for{" "}
                          <span className="font-medium text-foreground">
                            Member
                          </span>{" "}
                          to unlock full server access.
                        </p>
                        <Button
                          onClick={() => handleApply("member")}
                          disabled={
                            !!applyLoading ||
                            userStatus.hasPending
                          }
                          className="w-full"
                        >
                          {applyLoading === "member" ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Submitting...
                            </>
                          ) : (
                            "Apply for Member"
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 4 — Approvals (mod+ only) */}
          {!isRoleLoading && isModerator && (
            <motion.div variants={item}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                    >
                      <svg
                        className={`${designTokens.icons.md} ${designTokens.iconColors.orange}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Approvals
                        {pendingRequests.length > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-orange-500 text-white">
                            {pendingRequests.length}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Moderator+ only · Live synced
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
                      <svg
                        className="w-10 h-10 opacity-30"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm">No pending requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      <AnimatePresence>
                        {pendingRequests.map((req) => (
                          <motion.div
                            key={req.userId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                          >
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0 overflow-hidden">
                              {req.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={req.avatar}
                                  alt={req.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {req.displayName?.[0]?.toUpperCase() ?? "?"}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {req.displayName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                    req.requestedRole
                                      .toLowerCase()
                                      .includes("member")
                                      ? "bg-blue-500/15 text-blue-500"
                                      : "bg-green-500/15 text-green-500"
                                  }`}
                                >
                                  {req.requestedRole}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(req.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Button
                                size="sm"
                                className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white text-xs"
                                disabled={
                                  approveLoading === req.userId ||
                                  rejectLoading === req.userId
                                }
                                onClick={() => {
                                  setApproveModal({
                                    userId: req.userId,
                                    username: req.displayName,
                                    requestedRole: req.requestedRole,
                                  });
                                  setNickname("");
                                }}
                              >
                                {approveLoading === req.userId ? (
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  "Approve"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                                disabled={
                                  rejectLoading === req.userId ||
                                  approveLoading === req.userId
                                }
                                onClick={() =>
                                  handleReject(req.userId, req.displayName)
                                }
                              >
                                {rejectLoading === req.userId ? (
                                  <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  "Reject"
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
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

