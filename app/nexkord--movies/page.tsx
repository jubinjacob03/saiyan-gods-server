"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Search, Loader2, Info, User, ChevronDown, Plus, ThumbsUp, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { fetchTMDB, searchTMDB, CATEGORIES, getTmdbImgUrl } from "@/lib/tmdb";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AnimatedLogo from "@/components/AnimatedLogo";
import { 
  getRecentlyWatched, addRecentlyWatched, 
  getMyList, toggleMyList, 
  getSearchHistory, addSearchHistory, removeSearchHistory 
} from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
  
  const [heroItem, setHeroItem] = useState<any>(null);
  const [apiRows, setApiRows] = useState<{ title: string; items: any[]; defaultType: string }[]>([]);
  const [localRows, setLocalRows] = useState<{ title: string; items: any[]; defaultType: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [myListIds, setMyListIds] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistoryState] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
      }
    };
    fetchUser();
    refreshLocalState();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (apiKey) {
      loadContent();
    }
  }, [apiKey]);

  const refreshLocalState = () => {
    const recent = getRecentlyWatched();
    const list = getMyList();
    const hist = getSearchHistory();
    
    setMyListIds(new Set(list.map(i => i.id)));
    setSearchHistoryState(hist);
    
    const lRows = [];
    if (list.length > 0) lRows.push({ title: "My List", items: list, defaultType: "movie" });
    if (recent.length > 0) lRows.push({ title: "Continue Watching", items: recent, defaultType: "movie" });
    setLocalRows(lRows);
  };

  const loadContent = async () => {
    setIsLoading(true);
    try {
      const trending = await fetchTMDB("/trending/all/day", apiKey);
      if (trending?.results?.length > 0) {
        setHeroItem(trending.results[0]);
      }

      const newRows = [];
      for (const cat of CATEGORIES) {
        const data = await fetchTMDB(cat.url, apiKey);
        if (data?.results?.length > 0) {
          newRows.push({
            title: cat.title,
            items: data.results,
            defaultType: cat.url.includes("/tv") ? "tv" : "movie",
          });
        }
      }
      setApiRows(newRows);
    } catch (err: any) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const executeSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchQuery(query);
    setShowHistory(false);
    setIsSearching(true);
    addSearchHistory(query);
    refreshLocalState();
    
    try {
      const results = await searchTMDB(query, apiKey);
      if (results?.results) {
        setSearchResults(results.results.filter((item: any) => item.poster_path && (item.media_type === "movie" || item.media_type === "tv")));
      }
    } catch (err: any) {
      console.error(err);
    }
    setIsSearching(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const removeHistoryItem = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    removeSearchHistory(query);
    refreshLocalState();
  };

  const openPlayer = (item: any, defaultType: string, srvIdx = 0) => {
    const type = item.media_type || defaultType;
    addRecentlyWatched({ ...item, media_type: type });
    refreshLocalState();
    router.push(`/nexkord--movies/watch?t=${type}&v=${item.id}&server=${srvIdx}`);
  };

  const handleToggleMyList = (e: React.MouseEvent, item: any, defaultType: string) => {
    e.stopPropagation();
    const type = item.media_type || defaultType;
    toggleMyList({ ...item, media_type: type });
    refreshLocalState();
  };

  const allRows = [...localRows, ...apiRows];

  return (
    <div className="min-h-screen bg-[#141414] text-white overflow-x-hidden pb-20 font-sans selection:bg-[#e50914] selection:text-white" onClick={() => setShowHistory(false)}>
      {/* Header */}
      <header className={`fixed top-0 w-full pl-16 pr-4 md:pl-20 md:pr-12 py-4 z-50 flex justify-between items-center transition-all duration-500 ${isScrolled || searchOpen ? 'bg-[#141414] shadow-lg' : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'}`}>
        <div className="flex items-center gap-8 md:gap-12">
          <div className="cursor-pointer" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
            <AnimatedLogo />
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-300">
            <a href="#" className="text-white font-bold transition-colors">Home</a>
            <a href="#" className="hover:text-gray-400 transition-colors">TV Shows</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Movies</a>
            <a href="#" className="hover:text-gray-400 transition-colors">New & Popular</a>
            <a href="#" className="hover:text-gray-400 transition-colors">My List</a>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleSearchSubmit} 
              className={`flex items-center bg-black/60 border transition-all duration-300 ${searchOpen ? 'border-white' : 'border-transparent'}`}
            >
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="rounded-none hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchOpen(!searchOpen);
                  if (!searchOpen) setShowHistory(true);
                }}
              >
                <Search className="w-5 h-5 text-white" />
              </Button>
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Titles, people, genres" 
                className={`bg-transparent text-white text-sm outline-none transition-all duration-300 ${searchOpen ? 'w-32 sm:w-48 md:w-64 px-2 py-1.5 opacity-100' : 'w-0 px-0 opacity-0'}`}
              />
              {isSearching && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            </motion.form>
            
            {/* Search History Dropdown */}
            {searchOpen && showHistory && searchHistory.length > 0 && !searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 border border-gray-800 rounded-md shadow-2xl py-2 z-50" onClick={e => e.stopPropagation()}>
                <div className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Searches</div>
                {searchHistory.map((hist, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 cursor-pointer text-sm" onClick={() => executeSearch(hist)}>
                    <div className="flex items-center gap-3 text-gray-300">
                      <Search className="w-4 h-4 text-gray-500" />
                      {hist}
                    </div>
                    <X className="w-4 h-4 text-gray-500 hover:text-white" onClick={(e) => removeHistoryItem(e, hist)} />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div 
            className="relative" 
            onMouseEnter={() => setProfileDropdownOpen(true)}
            onMouseLeave={() => setProfileDropdownOpen(false)}
          >
            <div 
              className="w-8 h-8 rounded flex items-center justify-center cursor-pointer hover:ring-2 ring-white transition-all overflow-hidden bg-gray-800" 
              onClick={() => {
                if (!user) router.push('/login');
              }}
            >
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>

            {/* Profile Dropdown */}
            {profileDropdownOpen && user && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-md shadow-2xl py-2 z-50 transition-opacity">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded overflow-hidden bg-gray-800 shrink-0">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-1" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate text-white">{user.user_metadata?.full_name || user.email}</p>
                  </div>
                </div>
                <div 
                  className="px-4 py-3 hover:underline cursor-pointer text-sm text-gray-300"
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    router.push('/login');
                  }}
                >
                  Sign out of Nexkord
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isLoading ? (
          /* Loading Skeletons */
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-32 px-12 space-y-12">
            <div className="w-full h-[60vh] bg-gray-800/50 animate-pulse rounded-lg" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="w-48 h-6 bg-gray-800/50 animate-pulse rounded" />
                <div className="flex gap-4 overflow-hidden">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="w-[160px] aspect-[2/3] bg-gray-800/50 animate-pulse rounded-md shrink-0" />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : searchResults.length > 0 ? (
          /* Search Results View */
          <motion.div 
            key="search-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pt-32 px-4 md:px-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-400">Explore titles related to: <span className="text-white">{searchQuery}</span></h2>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3 md:gap-4">
              {searchResults.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.05, zIndex: 10 }}
                  className="cursor-pointer relative group rounded-md overflow-hidden aspect-[2/3] shadow-lg"
                  onClick={() => openPlayer(item, "movie")}
                >
                  <img 
                    src={getTmdbImgUrl(item.poster_path, "poster")} 
                    alt={item.title || item.name} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2">
                    <Play className="w-12 h-12 text-white fill-white drop-shadow-lg" />
                    <div 
                      className="w-10 h-10 bg-black/50 hover:bg-white hover:text-black rounded-full flex items-center justify-center border border-white/50 transition-colors"
                      onClick={(e) => handleToggleMyList(e, item, "movie")}
                    >
                      {myListIds.has(item.id) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Main View */
          <motion.div 
            key="main-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Hero Section */}
            {heroItem && (
              <div className="relative h-[85vh] md:h-[95vh] w-full">
                <div className="absolute inset-0">
                  <img 
                    src={getTmdbImgUrl(heroItem.backdrop_path, "hero")} 
                    className="w-full h-full object-cover"
                    alt="Hero Background"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="relative z-10 flex flex-col justify-center h-full px-4 md:px-12 w-full md:w-[50%]"
                >
                  <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-4 drop-shadow-2xl leading-tight mt-10 md:mt-0">
                    {heroItem.title || heroItem.name}
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl mb-6 md:mb-8 drop-shadow-md line-clamp-3 text-gray-200 font-medium max-w-2xl">
                    {heroItem.overview}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                    <Button 
                      size="lg" 
                      className="bg-white text-black hover:bg-white/80 font-bold text-base md:text-lg xl:text-xl px-4 sm:px-6 md:px-8 py-5 md:py-6 rounded-md transition-transform hover:scale-105 w-full sm:w-auto justify-center"
                      onClick={() => openPlayer(heroItem, "movie")}
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 mr-2 fill-black" /> Play
                    </Button>
                    <Button 
                      size="lg" 
                      className="bg-gray-500/70 text-white hover:bg-gray-500/50 font-bold text-base md:text-lg xl:text-xl px-4 sm:px-6 md:px-8 py-5 md:py-6 rounded-md transition-transform hover:scale-105 w-full sm:w-auto justify-center"
                      onClick={(e) => handleToggleMyList(e, heroItem, "movie")}
                    >
                      {myListIds.has(heroItem.id) ? <Check className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 mr-2" /> : <Plus className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 mr-2" />} 
                      {myListIds.has(heroItem.id) ? "In My List" : "My List"}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Rows */}
            <div className="mt-[-100px] md:mt-[-150px] relative z-20 space-y-8 md:space-y-12 pb-12">
              {allRows.map((row, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                  className="px-4 md:px-12"
                >
                  <h2 className="text-xl md:text-2xl font-semibold mb-2 md:mb-4 text-[#e5e5e5] hover:text-white cursor-pointer transition-colors flex items-center group">
                    {row.title}
                    <span className="text-[#54b9c5] text-sm ml-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Explore All <ChevronDown className="w-4 h-4 -rotate-90 ml-1" />
                    </span>
                  </h2>
                  <div className="flex gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide pb-32 pt-16 -mt-16 -mb-20">
                    {row.items.map((item) => {
                      if (!item.poster_path) return null;
                      return (
                        <motion.div 
                          key={item.id} 
                          whileHover={{ scale: 1.3, zIndex: 50, y: -20 }}
                          transition={{ delay: 0.4, duration: 0.3 }}
                          className="relative w-[120px] md:w-[160px] shrink-0 cursor-pointer rounded-md shadow-xl group"
                          onClick={() => openPlayer(item, row.defaultType)}
                        >
                          <img 
                            src={getTmdbImgUrl(item.poster_path, "poster")} 
                            alt={item.title || item.name} 
                            className="w-full h-auto object-cover rounded-md group-hover:rounded-b-none transition-all duration-300"
                            loading="lazy"
                          />
                          {/* Advanced Hover Card Details */}
                          <div className="absolute top-full left-0 w-full bg-[#181818] p-3 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 rounded-b-md shadow-[0_10px_20px_rgba(0,0,0,0.8)] pointer-events-none hidden md:block">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex gap-1 pointer-events-auto">
                                <div 
                                  className="w-6 h-6 bg-white hover:bg-gray-300 cursor-pointer rounded-full flex items-center justify-center transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openPlayer(item, row.defaultType); }}
                                >
                                  <Play className="w-3 h-3 text-black fill-black ml-0.5" />
                                </div>
                                <div 
                                  className="w-6 h-6 border-2 border-gray-500 hover:border-white cursor-pointer rounded-full flex items-center justify-center transition-colors bg-[#181818]"
                                  onClick={(e) => handleToggleMyList(e, item, row.defaultType)}
                                >
                                  {myListIds.has(item.id) ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-white" />}
                                </div>
                                <div className="w-6 h-6 border-2 border-gray-500 hover:border-white cursor-pointer rounded-full flex items-center justify-center transition-colors bg-[#181818]">
                                  <ThumbsUp className="w-3 h-3 text-white" />
                                </div>
                              </div>
                              <div className="w-6 h-6 border-2 border-gray-500 rounded-full flex items-center justify-center">
                                <ChevronDown className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              {item.vote_average ? (
                                <span className="text-green-500 font-bold text-[10px]">{(item.vote_average * 10).toFixed(0)}% Match</span>
                              ) : (
                                <span className="text-green-500 font-bold text-[10px]">New</span>
                              )}
                              <span className="border border-gray-600 px-1 text-[8px] text-gray-300">HD</span>
                            </div>
                            <p className="text-white font-bold text-xs truncate">{item.title || item.name}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}