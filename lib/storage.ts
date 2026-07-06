export interface MediaItem {
  id: string;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
}

const RECENTLY_WATCHED_KEY = 'nexkord_recently_watched';
const MY_LIST_KEY = 'nexkord_my_list';
const PREFERRED_SERVER_KEY = 'nexkord_preferred_server';
const SEARCH_HISTORY_KEY = 'nexkord_search_history';

// Helper to safely parse JSON
const safeParse = (key: string, fallback: any = []) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`Error parsing localStorage for ${key}`, error);
    return fallback;
  }
};

const safeSet = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage for ${key}`, error);
  }
};

// -- RECENTLY WATCHED --
export const getRecentlyWatched = (): MediaItem[] => safeParse(RECENTLY_WATCHED_KEY, []);

export const addRecentlyWatched = (item: MediaItem) => {
  if (!item || !item.id) return;
  
  const current = getRecentlyWatched();
  // Remove if it already exists to move it to the front
  const filtered = current.filter(m => m.id !== item.id);
  // Add to front, keep max 20
  const updated = [item, ...filtered].slice(0, 20);
  safeSet(RECENTLY_WATCHED_KEY, updated);
};

// -- MY LIST --
export const getMyList = (): MediaItem[] => safeParse(MY_LIST_KEY, []);

export const isInMyList = (id: string): boolean => {
  const current = getMyList();
  return current.some(m => m.id === id);
};

export const toggleMyList = (item: MediaItem) => {
  if (!item || !item.id) return false;
  
  let current = getMyList();
  const exists = current.some(m => m.id === item.id);
  
  if (exists) {
    current = current.filter(m => m.id !== item.id);
  } else {
    current = [item, ...current];
  }
  
  safeSet(MY_LIST_KEY, current);
  return !exists; // returns true if added, false if removed
};

// -- PREFERRED SERVER --
export const getPreferredServer = (fallbackIndex: number = 0): number => {
  const val = safeParse(PREFERRED_SERVER_KEY, fallbackIndex);
  return typeof val === 'number' ? val : fallbackIndex;
};

export const setPreferredServer = (index: number) => {
  safeSet(PREFERRED_SERVER_KEY, index);
};

// -- SEARCH HISTORY --
export const getSearchHistory = (): string[] => safeParse(SEARCH_HISTORY_KEY, []);

export const addSearchHistory = (query: string) => {
  if (!query || !query.trim()) return;
  const q = query.trim();
  
  const current = getSearchHistory();
  const filtered = current.filter(s => s.toLowerCase() !== q.toLowerCase());
  const updated = [q, ...filtered].slice(0, 10); // keep top 10
  safeSet(SEARCH_HISTORY_KEY, updated);
};

export const removeSearchHistory = (query: string) => {
  const current = getSearchHistory();
  const updated = current.filter(s => s.toLowerCase() !== query.toLowerCase());
  safeSet(SEARCH_HISTORY_KEY, updated);
};
