import { NextRequest, NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '6c8413a9f02eb6b5dfbb320140d3a5a7';
const YTS_TRACKERS = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://glotorrents.pw:6969/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://torrent.gresille.org:80/announce',
  'udp://p4p.arenabg.com:1337',
  'udp://tracker.leechers-paradise.org:6969',
  'wss://tracker.openwebtorrent.com', // CRITICAL: WebSocket tracker for WebTorrent
  'wss://tracker.webtorrent.dev',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz'
];

export async function GET(req: NextRequest) {
  try {
    const tmdbId = req.nextUrl.searchParams.get('tmdbId');
    const type = req.nextUrl.searchParams.get('type') || 'movie';
    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 });
    }

    // 1. Get IMDB ID from TMDB
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`
    );
    const tmdbData = await tmdbRes.json();
    const imdbId = tmdbData.imdb_id;

    if (!imdbId) {
      return NextResponse.json({ error: 'Could not find IMDB ID for this media.' }, { status: 404 });
    }

    // 2. Fetch torrents from Torrentio API (more reliable than YTS directly)
    let url = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
    if (type === 'tv') {
      const season = req.nextUrl.searchParams.get('season') || '1';
      const episode = req.nextUrl.searchParams.get('episode') || '1';
      url = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
    }

    let torrentioData = null;
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      torrentioData = await res.json();
    } catch (e) {
      console.warn('Failed to fetch from Torrentio:', url);
    }

    if (!torrentioData || !torrentioData.streams || torrentioData.streams.length === 0) {
      return NextResponse.json({ error: 'No P2P streams found for this media.' }, { status: 404 });
    }

    // 3. Filter for MP4/WebM files (WebTorrent browser limit)
    const validStreams = torrentioData.streams.filter((s: any) => 
      s.behaviorHints?.filename?.toLowerCase().endsWith('.mp4') ||
      s.behaviorHints?.filename?.toLowerCase().endsWith('.webm')
    );

    if (validStreams.length === 0) {
      return NextResponse.json({ error: 'No browser-compatible streams (MP4) found. Only MKV available.' }, { status: 404 });
    }

    // Prefer 1080p, fallback to anything else
    let bestStream = validStreams.find((s: any) => s.name?.includes('1080p') || s.title?.includes('1080p'));
    if (!bestStream) {
      bestStream = validStreams.find((s: any) => s.name?.includes('720p') || s.title?.includes('720p'));
    }
    if (!bestStream) {
      bestStream = validStreams[0];
    }

    // 4. Construct Magnet URI
    // Format: magnet:?xt=urn:btih:[HASH]&dn=[URL_ENCODED_NAME]&tr=[TRACKER_1]&tr=[TRACKER_2]
    const hash = bestStream.infoHash;
    const dn = encodeURIComponent(bestStream.behaviorHints?.filename || 'Movie');
    
    let magnetUri = `magnet:?xt=urn:btih:${hash}&dn=${dn}`;
    for (const tracker of YTS_TRACKERS) {
      magnetUri += `&tr=${encodeURIComponent(tracker)}`;
    }

    return NextResponse.json({
      magnet: magnetUri,
      quality: bestStream.name,
      filename: bestStream.behaviorHints?.filename
    });

  } catch (error) {
    console.error('Stream API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
