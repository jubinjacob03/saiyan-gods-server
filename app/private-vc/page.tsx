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

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface BotMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

interface VCMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  inVC: boolean;
}

interface PrivateVC {
  channelId: string;
  name: string;
  index: number;
  memberCount: number;
  members: VCMember[];
}

function Avatar({
  member,
  size = 8,
}: {
  member: { id: string; avatar: string | null; displayName: string };
  size?: number;
}) {
  const src = member.avatar
    ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.webp?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(member.id) % 5}.png`;
  return (
    <img
      src={src}
      alt={member.displayName}
      className={`w-${size} h-${size} rounded-full object-cover`}
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          `https://cdn.discordapp.com/embed/avatars/0.png`;
      }}
    />
  );
}

function MemberSelectModal({
  open,
  onClose,
  allMembers,
  currentUserId,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  allMembers: BotMember[];
  currentUserId: string;
  onConfirm: (memberIds: string[]) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filterable = allMembers.filter((m) => m.id !== currentUserId);
  const filtered = filterable.filter(
    (m) =>
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.username.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id); // max 4 extra (total 5 with owner)
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
  };

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-md mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Create Private VC</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select up to 4 members to invite (you are included automatically)
          </p>
        </div>
        <div className="p-4 border-b border-border">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="overflow-y-auto max-h-64 p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No members found
            </p>
          ) : (
            filtered.map((m) => {
              const isSelected = selected.has(m.id);
              const isDisabled = !isSelected && selected.size >= 4;
              return (
                <button
                  key={m.id}
                  onClick={() => !isDisabled && toggle(m.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-primary/20 border border-primary/40"
                      : isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted/60"
                  }`}
                >
                  <Avatar member={m} size={8} />
                  <div>
                    <p className="text-sm font-medium">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      @{m.username}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="p-4 border-t border-border flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Creating..." : `Create VC`}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PrivateVCPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [vcs, setVcs] = useState<PrivateVC[]>([]);
  const [allMembers, setAllMembers] = useState<BotMember[]>([]);
  const [loadingVCs, setLoadingVCs] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // `${vcId}-add-${userId}` etc.
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [addTarget, setAddTarget] = useState<{
    vcId: string;
    open: boolean;
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchVCs = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/private-vc");
      if (res.ok) {
        const json = await res.json();
        setVcs(json.data || []);
      }
    } catch {
    } finally {
      setLoadingVCs(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/members");
      if (res.ok) {
        const json = await res.json();
        setAllMembers(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const discordId =
          user.identities?.find((i) => i.provider === "discord")
            ?.identity_data?.sub || user.user_metadata?.provider_id || user.id;
        setCurrentUserId(discordId);
      }
    });
    fetchVCs();
    fetchMembers();
  }, [fetchVCs, fetchMembers]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchVCs, 15000);
    return () => clearInterval(interval);
  }, [fetchVCs]);

  const handleCreate = async (memberIds: string[]) => {
    if (!currentUserId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/bot/private-vc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, memberIds }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Private VC created!");
        setCreateModalOpen(false);
        await fetchVCs();
      } else {
        showToast(json.error || "Failed to create VC", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (vcId: string, targetUserId: string) => {
    if (!currentUserId) return;
    const key = `${vcId}-remove-${targetUserId}`;
    setActionLoading(key);
    try {
      const res = await fetch("/api/bot/private-vc/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: currentUserId, targetUserId }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Member removed");
        await fetchVCs();
      } else {
        showToast(json.error || "Failed to remove member", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdd = async (targetUserId: string) => {
    if (!currentUserId || !addTarget) return;
    const key = `${addTarget.vcId}-add-${targetUserId}`;
    setActionLoading(key);
    try {
      const res = await fetch("/api/bot/private-vc/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: currentUserId,
          targetUserId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Member added");
        setAddTarget(null);
        await fetchVCs();
      } else {
        showToast(json.error || "Failed to add member", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Members not already in the VC
  const addableMembers = (vc: PrivateVC) => {
    const inVC = new Set(vc.members.map((m) => m.id));
    return allMembers.filter((m) => !inVC.has(m.id));
  };

  const myVC = vcs.find((vc) =>
    vc.members.some((m) => m.id === currentUserId),
  );

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

      <MemberSelectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        allMembers={allMembers}
        currentUserId={currentUserId || ""}
        onConfirm={handleCreate}
        loading={creating}
      />

      {/* Add member modal */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-semibold">Add Member</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select a member to add to the VC
              </p>
            </div>
            <div className="overflow-y-auto max-h-64 p-2">
              {addableMembers(
                vcs.find((v) => v.channelId === addTarget.vcId)!,
              ).map((m) => {
                const key = `${addTarget.vcId}-add-${m.id}`;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleAdd(m.id)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                  >
                    <Avatar member={m} size={8} />
                    <div>
                      <p className="text-sm font-medium">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        @{m.username}
                      </p>
                    </div>
                    {actionLoading === key && (
                      <div className="ml-auto w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Button
                variant="outline"
                onClick={() => setAddTarget(null)}
                disabled={!!actionLoading}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={designTokens.typography.h1}>Private VC</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage private voice channels — up to 5 simultaneous
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVCs}
              disabled={loadingVCs}
            >
              <svg
                className={`${designTokens.icons.sm} ${loadingVCs ? "animate-spin" : ""}`}
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
              <span className="ml-1.5">Refresh</span>
            </Button>
            <Button onClick={() => setCreateModalOpen(true)}>
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create VC
            </Button>
          </div>
        </div>

        {/* Active VCs */}
        {loadingVCs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-56 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : vcs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div
                  className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.purple} mb-4`}
                >
                  <svg
                    className={`${designTokens.icons.lg} text-purple-500`}
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
                </div>
                <h3 className={designTokens.typography.h3}>
                  No active private VCs
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Create a private voice channel to start a session with your
                  crew.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create your first VC
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {vcs.map((vc) => {
              const isMyVC = vc.members.some((m) => m.id === currentUserId);
              return (
                <motion.div key={vc.channelId} variants={item}>
                  <Card
                    className={`h-full ${isMyVC ? "border-primary/40 bg-primary/5" : ""}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.purple}`}
                          >
                            <svg
                              className={`${designTokens.icons.md} text-purple-500`}
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
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {vc.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {vc.memberCount} member
                              {vc.memberCount !== 1 ? "s" : ""}
                            </CardDescription>
                          </div>
                        </div>
                        {isMyVC && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                            Your VC
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Member list */}
                      <div className="space-y-1.5">
                        {vc.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2.5 group"
                          >
                            <div className="relative">
                              <Avatar member={m} size={7} />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                                  m.inVC ? "bg-green-500" : "bg-gray-400"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {m.displayName}
                              </p>
                            </div>
                            {m.id !== currentUserId && isMyVC && (
                              <button
                                onClick={() =>
                                  handleRemove(vc.channelId, m.id)
                                }
                                disabled={
                                  actionLoading ===
                                  `${vc.channelId}-remove-${m.id}`
                                }
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 disabled:opacity-50"
                                title="Remove member"
                              >
                                {actionLoading ===
                                `${vc.channelId}-remove-${m.id}` ? (
                                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add member button */}
                      {isMyVC && vc.memberCount < 5 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() =>
                            setAddTarget({
                              vcId: vc.channelId,
                              open: true,
                            })
                          }
                        >
                          <svg
                            className="w-3.5 h-3.5 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Add Member
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Info footer */}
        <p className="text-xs text-muted-foreground text-center">
          Private VCs auto-close after 5 min idle or 3 hours max · Green dot =
          currently in VC · Refreshes every 15s
        </p>
      </div>
    </AppLayout>
  );
}
