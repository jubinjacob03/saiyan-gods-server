"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase";

// ─── Role constants (must match sounds/page.tsx)
const MODERATOR_ROLE_ID = "1473075468088377349";
const MANAGER_ROLE_ID = "1473075468088377350";
const OWNER_ROLE_ID = "1473075468088377352";
const UPLOAD_ROLES = new Set([
  MODERATOR_ROLE_ID,
  MANAGER_ROLE_ID,
  OWNER_ROLE_ID,
]);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // ── Permission state
  const [canUpload, setCanUpload] = useState<boolean | null>(null); // null = checking
  const [discordUserId, setDiscordUserId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setCanUpload(false);
          return;
        }
        const discordIdentity = user.identities?.find(
          (i) => i.provider === "discord",
        );
        const id = discordIdentity?.identity_data?.sub || user.id;
        setDiscordUserId(id);
        const res = await fetch(`/api/bot/members?userId=${id}`);
        if (res.ok) {
          const json = await res.json();
          const roleIds: string[] = json.data?.roleIds ?? [];
          setCanUpload(roleIds.some((r) => UPLOAD_ROLES.has(r)));
        } else {
          setCanUpload(false);
        }
      } catch {
        setCanUpload(false);
      }
    })();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("audio/")) {
        setFile(droppedFile);
        if (!name) {
          setName(droppedFile.name.replace(/\.[^/.]+$/, ""));
        }
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !name) {
      setMessage("Please provide both file and name");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setMessage("File must be under 15MB");
      return;
    }

    const duration = await getAudioDuration(file);
    if (duration > 600) {
      setMessage("Audio must be under 10 minutes");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("sounds")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("sounds").getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("sounds").insert({
        name,
        file_url: publicUrl,
        file_size: file.size,
        duration: Math.floor(duration),
        uploaded_by: discordUserId || "unknown",
      });

      if (dbError) throw dbError;

      setMessage("✅ Upload successful!");
      setFile(null);
      setName("");

      setTimeout(() => {
        window.location.href = "/sounds";
      }, 1500);
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
    });
  };

  // ── Role check guards
  if (canUpload === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <svg
              className="h-10 w-10 text-primary"
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
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  if (!canUpload) {
    return (
      <AppLayout>
        <motion.div
          className="flex flex-col items-center justify-center py-24 gap-6 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="p-6 rounded-full bg-destructive/10">
            <svg
              className="h-12 w-12 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground max-w-sm">
              Only Moderators, Managers, and the Owner can upload sounds.
            </p>
          </div>
          <a
            href="/sounds"
            className="underline text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Sound Library
          </a>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className={`${designTokens.typography.h1} mb-3`}>Upload Audio</h1>
          <p className={designTokens.typography.bodyMuted}>
            Add new audio files to your library
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className={designTokens.cards.elevated}>
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <CardTitle className={designTokens.typography.h2}>
                    Upload New Sound
                  </CardTitle>
                  <CardDescription
                    className={`${designTokens.typography.smallMuted} flex items-center gap-4 mt-2`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      15MB
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      10 mins
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleUpload}
                className={designTokens.spacing.cardSection}
              >
                <motion.div
                  className={designTokens.spacing.inputGroup}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Label
                    htmlFor="name"
                    className={`${designTokens.typography.body} flex items-center gap-2`}
                  >
                    <svg
                      className={`${designTokens.icons.sm} ${designTokens.iconColors.muted}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Sound Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter a descriptive name"
                    className={designTokens.components.input}
                    required
                  />
                </motion.div>

                <motion.div
                  className={designTokens.spacing.inputGroup}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Label
                    htmlFor="file"
                    className={`${designTokens.typography.body} flex items-center gap-2`}
                  >
                    <svg
                      className={`${designTokens.icons.sm} ${designTokens.iconColors.muted}`}
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
                    Audio File
                  </Label>

                  <motion.div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    animate={{
                      borderColor: dragActive
                        ? "hsl(var(--primary))"
                        : "hsl(var(--border))",
                      backgroundColor: dragActive
                        ? "hsl(var(--primary) / 0.05)"
                        : "transparent",
                    }}
                    className="relative border-2 border-dashed rounded-lg p-8 transition-colors"
                  >
                    <Input
                      id="file"
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0] || null;
                        setFile(selectedFile);
                        if (selectedFile && !name) {
                          setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required={!file}
                    />
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <motion.div
                        animate={{ y: dragActive ? -5 : 0 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className={`${designTokens.iconContainer} p-4 rounded-full ${designTokens.iconBackgrounds.primary}`}
                      >
                        <svg
                          className={
                            designTokens.icons.md +
                            " " +
                            designTokens.iconColors.primary
                          }
                          style={{ height: "2rem", width: "2rem" }}
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
                      </motion.div>
                      <div>
                        <p className={designTokens.typography.h3}>
                          {dragActive
                            ? "Drop your file here"
                            : "Click to browse or drag and drop"}
                        </p>
                        <p className={`${designTokens.typography.small} mt-1`}>
                          MP3, WAV, OGG, or any audio format
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {file && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
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
                                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`${designTokens.typography.h3} truncate`}
                            >
                              {file.name}
                            </p>
                            <p className={designTokens.typography.small}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            onClick={() => setFile(null)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-1 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                          >
                            <svg
                              className={designTokens.icons.md}
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
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    type="submit"
                    disabled={uploading}
                    className={
                      designTokens.components.button + " w-full font-semibold"
                    }
                    size="lg"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <motion.svg
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            ease: "linear",
                          }}
                          className={designTokens.icons.md}
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
                        </motion.svg>
                        <span>Uploading...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg
                          className={designTokens.icons.md}
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
                        Upload Sound
                      </span>
                    )}
                  </Button>
                </motion.div>

                <AnimatePresence>
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className={`overflow-hidden rounded-lg p-5 text-base font-medium flex items-center gap-3 ${
                        message.includes("Error") || message.includes("❌")
                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                          : "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30"
                      }`}
                    >
                      {message.includes("Error") || message.includes("❌") ? (
                        <svg
                          className="h-5 w-5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
