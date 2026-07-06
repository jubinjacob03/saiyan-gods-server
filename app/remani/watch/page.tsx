"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiscordSync } from "@/lib/discord";
import { useRouter, useSearchParams } from "next/navigation";
import TorrentPlayer from "@/components/TorrentPlayer";

function WatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const type = searchParams.get("t") || "movie";
  const id = searchParams.get("v") || "";
  
  const [magnetUri, setMagnetUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { remoteState, broadcastState, logAction } = useDiscordSync();
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (logAction && id) logAction("watch_started", `Started watching ${type} ${id} via WebTorrent`);
  }, [id, type, logAction]);

  // Fetch Magnet Link from API
  useEffect(() => {
    if (!id || type !== 'movie') {
      if (type !== 'movie') {
        setError('TV Shows are not yet supported in this preview.');
        setLoading(false);
      }
      return;
    }

    const fetchMagnet = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/stream?tmdbId=${id}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch stream link');
        }
        
        setMagnetUri(data.magnet);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMagnet();
  }, [id, type]);

  // Handle Discord Sync
  useEffect(() => {
    if (remoteState) {
      isRemoteUpdate.current = true;
      if (remoteState.state === "play_media") {
        if (remoteState.media.id !== id || remoteState.media.type !== type) {
          router.push(`/remani/watch?t=${remoteState.media.type}&v=${remoteState.media.id}`);
        }
      } else if (remoteState.state === "close_media") {
        router.push("/remani");
      }
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 500);
    }
  }, [remoteState, id, type, router]);

  const handleBack = () => {
    if (logAction) logAction("back_to_home", "Clicked back to home button");
    if (!isRemoteUpdate.current) {
      broadcastState("close_media");
    }
    router.push("/remani");
  };

  if (!id) return <div className="bg-black min-h-screen"></div>;

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans">
      <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/60 to-transparent absolute top-0 w-full z-20 pt-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/20 rounded-full bg-black/40 backdrop-blur-md border border-white/10 ml-4 flex items-center" 
            onClick={handleBack}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full bg-black relative flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center justify-center bg-[#141414] absolute inset-0 z-10">
            <Loader2 className="w-12 h-12 text-[#e50914] animate-spin mb-4" />
            <h3 className="text-xl font-bold text-white tracking-wide">Searching the Web...</h3>
            <p className="text-gray-400 font-medium">Finding the highest quality P2P stream</p>
          </div>
        )}
        
        {error && (
          <div className="flex flex-col items-center justify-center bg-[#141414] absolute inset-0 z-10 px-4 text-center">
            <h3 className="text-2xl font-bold text-red-500 mb-2">Stream Not Found</h3>
            <p className="text-gray-300 max-w-md">{error}</p>
          </div>
        )}

        {magnetUri && !loading && !error && (
          <div className="w-full h-full relative z-0">
             <TorrentPlayer magnetUri={magnetUri} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen"></div>}>
      <WatchContent />
    </Suspense>
  );
}
