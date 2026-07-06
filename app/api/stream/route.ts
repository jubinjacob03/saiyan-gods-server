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
    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 });
    }

    // 1. Get IMDB ID from TMDB
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`
    );
    const tmdbData = await tmdbRes.json();
    const imdbId = tmdbData.imdb_id;

    if (!imdbId) {
      return NextResponse.json({ error: 'Could not find IMDB ID for this movie.' }, { status: 404 });
    }

    // 2. Fetch torrents from YTS API
    // Using a known mirror just in case yts.mx is blocked
    const ytsUrls = [
      `https://yts.mx/api/v2/movie_details.json?imdb_id=${imdbId}`,
      `https://yts.torrentbay.to/api/v2/movie_details.json?imdb_id=${imdbId}`
    ];

    let ytsData = null;
    for (const url of ytsUrls) {
      try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        if (data.status === 'ok') {
          ytsData = data;
          break;
        }
      } catch (e) {
        console.warn('Failed to fetch from YTS mirror:', url);
      }
    }

    if (!ytsData || !ytsData.data || !ytsData.data.movie || !ytsData.data.movie.torrents) {
      return NextResponse.json({ error: 'No streams found for this movie on YTS.' }, { status: 404 });
    }

    const torrents = ytsData.data.movie.torrents;
    // Prefer 1080p, fallback to 720p
    let bestTorrent = torrents.find((t: any) => t.quality === '1080p');
    if (!bestTorrent) {
      bestTorrent = torrents.find((t: any) => t.quality === '720p');
    }
    if (!bestTorrent) {
      bestTorrent = torrents[0];
    }

    // 3. Construct Magnet URI
    // Format: magnet:?xt=urn:btih:[HASH]&dn=[URL_ENCODED_NAME]&tr=[TRACKER_1]&tr=[TRACKER_2]
    const hash = bestTorrent.hash;
    const dn = encodeURIComponent(ytsData.data.movie.title_long || 'Movie');
    
    let magnetUri = `magnet:?xt=urn:btih:${hash}&dn=${dn}`;
    for (const tracker of YTS_TRACKERS) {
      magnetUri += `&tr=${encodeURIComponent(tracker)}`;
    }

    return NextResponse.json({
      magnet: magnetUri,
      quality: bestTorrent.quality,
      size: bestTorrent.size
    });

  } catch (error) {
    console.error('Stream API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
