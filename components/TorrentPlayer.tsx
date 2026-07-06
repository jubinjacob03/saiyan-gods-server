'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';

interface TorrentPlayerProps {
  magnetUri: string;
}

export default function TorrentPlayer({ magnetUri }: TorrentPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [peers, setPeers] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // We need to wait for the script to load and initialize
    const initWebTorrent = () => {
      // @ts-ignore
      if (!window.WebTorrent) {
        setTimeout(initWebTorrent, 500);
        return;
      }

      // @ts-ignore
      const client = new window.WebTorrent();

      client.on('error', (err: any) => {
        console.error('WebTorrent Error:', err);
        setError('Failed to connect to torrent network. ' + err.message);
        setLoading(false);
      });

      try {
        client.add(magnetUri, (torrent: any) => {
          console.log('Client is downloading:', torrent.infoHash);

          // Find the mp4 file
          const file = torrent.files.find((f: any) => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'));
          
          if (!file) {
            setError('No compatible video file found in torrent.');
            setLoading(false);
            return;
          }

          if (videoRef.current) {
            // Append the file stream to the video element
            file.renderTo(videoRef.current);
            setLoading(false);
          }

          // Track stats
          const interval = setInterval(() => {
            setDownloadSpeed((torrent.downloadSpeed / 1024 / 1024).toFixed(2) + ' MB/s');
            setPeers(torrent.numPeers);
          }, 1000);

          torrent.on('done', () => {
            clearInterval(interval);
            setDownloadSpeed('Completed');
          });
        });
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }

      return () => {
        client.destroy();
      };
    };

    const cleanup = initWebTorrent();

    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, [magnetUri]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center">
      <Script 
        src="https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js" 
        strategy="afterInteractive"
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-6 text-center">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      )}

      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-white font-medium">Connecting to Peers...</p>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>Finding sources via WebRTC...</span>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="absolute top-4 right-4 z-10 flex gap-4 text-xs font-mono bg-black/60 px-3 py-1.5 rounded-full text-gray-300">
          <span>⬇ {downloadSpeed}</span>
          <span>👥 {peers} peers</span>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        className="w-full h-full object-contain"
        autoPlay
      />
    </div>
  );
}
