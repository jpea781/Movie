import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const IMG = "https://image.tmdb.org/t/p/original";

// ================= Simple Error Boundary =================
class SimpleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-6">Please refresh the page or try again later.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ================= Movie Item Component =================
const MovieItem = React.memo(({ item, type, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleClick = () => {
    onClick(item);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(item);
    }
  };

  // Check if movie is Tagalog
  const isTagalog = item.original_language === 'tl' || 
                     (item.origin_country && item.origin_country.includes('PH')) ||
                     (item.production_countries && item.production_countries.some(country => country.iso_3166_1 === 'PH'));

  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black rounded-xl"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Watch ${item.title || item.name}${isTagalog ? ' (Tagalog Movie)' : ''}`}
    >
      <div className="relative overflow-hidden rounded-xl aspect-[2/3] mb-2">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse rounded-xl" />
        )}
        
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity duration-300">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-red-600 rounded-full flex items-center justify-center">
            <span className="text-lg md:text-xl ml-1">▶</span>
          </div>
        </div>
        
        <img
          src={
            imgError 
              ? "https://via.placeholder.com/300x450/111/666?text=No+Poster"
              : item.poster_path
                ? `${IMG}${item.poster_path}`
                : "https://via.placeholder.com/300x450/111/666?text=No+Poster"
          }
          alt={`Poster for ${item.title || item.name}`}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          loading="lazy"
          onError={() => setImgError(true)}
          onLoad={() => setIsLoading(false)}
        />
        
        <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-full text-xs font-bold">
          ⭐ {item.vote_average?.toFixed(1) || "N/A"}
        </div>
        
        {/* Tagalog badge */}
        {isTagalog && (
          <div className="absolute top-2 left-2 bg-green-600 px-2 py-1 rounded-full text-xs font-bold">
            Tagalog
          </div>
        )}
      </div>
      
      <p className="font-medium text-sm md:text-base truncate group-hover:text-red-400 transition-colors duration-300">
        {item.title || item.name}
      </p>
      <p className="text-gray-400 text-xs md:text-sm">
        {item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || "Unknown"}
      </p>
    </div>
  );
});

MovieItem.displayName = 'MovieItem';

// ================= Main App Component =================
function App() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [category, setCategory] = useState("trending");
  const [type, setType] = useState("movie");
  const [search, setSearch] = useState("");
  const [watchUrl, setWatchUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  // Load More functionality states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Using useRef instead of state for timeout
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastMovieRef = useRef();
  const observerRef = useRef();

  // Track ad frequency and timing
  const [adsLoaded, setAdsLoaded] = useState(false);
  const lastAdTimeRef = useRef(0);
  const adCooldown = 60000; // 60 seconds between ads

  // Error messages mapping
  const errorMessages = useMemo(() => ({
    'Failed to fetch': 'Network error. Please check your connection.',
    'Search failed': 'Search service unavailable. Try again later.',
    'Failed to load content': 'Content loading failed. Refresh the page.',
    'default': 'An unexpected error occurred.'
  }), []);

  // ================= ULTRA-ROBUST AD LOADING FUNCTION =================
  const loadPopAds = useCallback(() => {
    const now = Date.now();
    
    // Don't load ads too frequently
    if (now - lastAdTimeRef.current < adCooldown) {
      console.log('⏳ Ad cooldown active, skipping');
      return;
    }
    
    // Don't reload ads if already loaded
    if (adsLoaded) {
      console.log('✅ Ads already loaded');
      return;
    }

    console.log('🚀 ATTEMPTING TO LOAD POPADS...');
    
    // Method 1: Direct script injection (most reliable)
    const injectPopAdsScript = () => {
      return new Promise((resolve) => {
        try {
          // Clean up any existing scripts
          document.querySelectorAll('script').forEach(script => {
            if (script.textContent && script.textContent.includes('a8876ec4588517dc1fe664b0e6812854')) {
              script.remove();
            }
          });

          // Create script element
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.setAttribute('data-cfasync', 'false');
          
          // Your PopAds code
          script.textContent = `/*<![CDATA[/* */(function(){var x=window,v="a8876ec4588517dc1fe664b0e6812854",d=[["siteId",847*577+608*61*11+4371892],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],u=["d3d3LmRpc3BsYXl2ZXJ0aXNpbmcuY29tL3lpbnN0YWZldGNoLm1pbi5jc3M=","ZDNtem9rdHk5NTFjNXcuY2xvdWRmcm9udC5uZXQvY2pYYnQvZ2pzb25saW50Lm1pbi5qcw=="],e=-1,m,c,n=function(){clearTimeout(c);e++;if(u[e]&&!(1794245271000<(new Date).getTime()&&1<e)){m=x.document.createElement("script");m.type="text/javascript";m.async=!0;var i=x.document.getElementsByTagName("script")[0];m.src="https://"+atob(u[e]);m.crossOrigin="anonymous";m.onerror=n;m.onload=function(){clearTimeout(c);x[v.slice(0,16)+v.slice(0,16)]||n()};c=setTimeout(n,5E3);i.parentNode.insertBefore(m,i)}};if(!x[v]){try{Object.freeze(x[v]=d)}catch(e){}n()}})();/*]]>/* */`;
          
          script.onload = () => {
            console.log('✅ PopAds script loaded');
            setTimeout(() => {
              if (window.a8876ec4588517dc1fe664b0e6812854) {
                console.log('🎉 PopAds initialized successfully!');
                setAdsLoaded(true);
                lastAdTimeRef.current = Date.now();
                resolve(true);
              } else {
                console.log('⚠️ Script loaded but PopAds not initialized');
                resolve(false);
              }
            }, 2000);
          };
          
          script.onerror = () => {
            console.warn('❌ Script failed to load');
            resolve(false);
          };
          
          // Append to body (more reliable than head)
          document.body.appendChild(script);
          
        } catch (error) {
          console.log('Error in injectPopAdsScript:', error);
          resolve(false);
        }
      });
    };

    // Method 2: Iframe injection (bypasses some blockers)
    const injectViaIframe = () => {
      return new Promise((resolve) => {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.srcdoc = `
            <!DOCTYPE html>
            <html>
              <head>
                <script type="text/javascript">
                  try {
                    ${`/*<![CDATA[/* */(function(){var x=window,v="a8876ec4588517dc1fe664b0e6812854",d=[["siteId",847*577+608*61*11+4371892],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],u=["d3d3LmRpc3BsYXl2ZXJ0aXNpbmcuY29tL3lpbnN0YWZldGNoLm1pbi5jc3M=","ZDNtem9rdHk5NTFjNXcuY2xvdWRmcm9udC5uZXQvY2pYYnQvZ2pzb25saW50Lm1pbi5qcw=="],e=-1,m,c,n=function(){clearTimeout(c);e++;if(u[e]&&!(1794245271000<(new Date).getTime()&&1<e)){m=x.document.createElement("script");m.type="text/javascript";m.async=!0;var i=x.document.getElementsByTagName("script")[0];m.src="https://"+atob(u[e]);m.crossOrigin="anonymous";m.onerror=n;m.onload=function(){clearTimeout(c);x[v.slice(0,16)+v.slice(0,16)]||n()};c=setTimeout(n,5E3);i.parentNode.insertBefore(m,i)}};if(!x[v]){try{Object.freeze(x[v]=d)}catch(e){}n()}})();/*]]>/* */`}
                    parent.postMessage('popads-loaded', '*');
                  } catch(e) {
                    parent.postMessage('popads-error', '*');
                  }
                <\/script>
              </head>
              <body></body>
            </html>
          `;
          
          // Listen for messages from iframe
          const messageHandler = (event) => {
            if (event.data === 'popads-loaded') {
              console.log('✅ PopAds loaded via iframe');
              window.removeEventListener('message', messageHandler);
              iframe.remove();
              setAdsLoaded(true);
              lastAdTimeRef.current = Date.now();
              resolve(true);
            } else if (event.data === 'popads-error') {
              console.log('❌ PopAds failed via iframe');
              window.removeEventListener('message', messageHandler);
              iframe.remove();
              resolve(false);
            }
          };
          
          window.addEventListener('message', messageHandler);
          document.body.appendChild(iframe);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            if (document.body.contains(iframe)) {
              iframe.remove();
            }
            console.log('⏱️ Iframe method timeout');
            resolve(false);
          }, 5000);
          
        } catch (error) {
          console.log('Error in injectViaIframe:', error);
          resolve(false);
        }
      });
    };

    // Try loading ads with multiple methods
    const tryAllMethods = async () => {
      console.log('Trying Method 1: Direct injection...');
      const method1Success = await injectPopAdsScript();
      
      if (!method1Success) {
        console.log('Method 1 failed, trying Method 2: Iframe...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const method2Success = await injectViaIframe();
        
        if (!method2Success) {
          console.log('❌ All ad loading methods failed');
          console.log('Possible reasons:');
          console.log('1. Ad blocker detected');
          console.log('2. Browser privacy settings');
          console.log('3. Network firewall blocking');
          console.log('4. PopAds requires more site traffic');
        }
      }
    };

    tryAllMethods();
  }, [adsLoaded]);

  // ================= Load initial ads after delay =================
  useEffect(() => {
    // Initial ad load after 5 seconds (once user has seen the page)
    const initialTimer = setTimeout(() => {
      loadPopAds();
    }, 5000);
    
    return () => {
      clearTimeout(initialTimer);
    };
  }, [loadPopAds]);

  // ================= Check API Key =================
  useEffect(() => {
    if (!API_KEY || API_KEY === 'undefined') {
      setError("API key is missing. Please check your .env file");
      console.error("TMDB API key is missing!");
    }
  }, []);

  // ================= UPDATED: More Categories =================
  const categoryLabels = useMemo(() => ({
    trending: "🔥 Trending",
    popular: "⭐ Popular", 
    top_rated: "🏆 Top Rated",
    upcoming: type === "movie" ? "📅 Upcoming" : "📅 Airing Today",
    now_playing: type === "movie" ? "🎬 Now Playing" : "🎬 On Air",
    filipino: "🎭 Tagalog Movie",
    action: "💥 Action",
    comedy: "😂 Comedy", 
    drama: "🎭 Drama",
    horror: "👻 Horror",
    romance: "❤️ Romance",
    thriller: "🔪 Thriller",
    scifi: "🚀 Sci-Fi",
    animation: "🐭 Animation"
  }), [type]);

  // ================= UPDATED: API Functions with Load More =================
  const fetchTrending = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/${type}/week?api_key=${API_KEY}&page=${pageNum}`
      );
      
      if (!res.ok) throw new Error("Failed to fetch");
      
      const data = await res.json();
      
      if (pageNum === 1) {
        setMovies(data.results || []);
        setFeatured(data.results?.[0] || null);
      } else {
        setMovies(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMore(pageNum < data.total_pages);
      setPage(pageNum);
      
    } catch (err) {
      setError(errorMessages[err.message] || errorMessages.default);
    } finally {
      setLoading(false);
    }
  }, [type, errorMessages]);

  const fetchByCategory = useCallback(async (cat, pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = "";
      
      if (cat === "filipino") {
        // Special endpoint for Tagalog movies
        if (type === "movie") {
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_original_language=tl&region=PH&sort_by=popularity.desc&page=${pageNum}&include_adult=false`;
        } else {
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=tl&sort_by=popularity.desc&page=${pageNum}&include_adult=false`;
        }
      }
      // Genre categories
      else if (["action", "comedy", "drama", "horror", "romance", "thriller", "scifi", "animation"].includes(cat)) {
        const genreMap = {
          action: 28,
          comedy: 35,
          drama: 18,
          horror: 27,
          romance: 10749,
          thriller: 53,
          scifi: 878,
          animation: 16
        };
        const genreId = genreMap[cat];
        
        if (type === "movie") {
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}&include_adult=false`;
        } else {
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}&include_adult=false`;
        }
      }
      else if (type === "movie") {
        endpoint = `https://api.themoviedb.org/3/movie/${cat}?api_key=${API_KEY}&page=${pageNum}`;
      } else {
        endpoint = cat === "upcoming" 
          ? `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&page=${pageNum}`
          : cat === "now_playing"
            ? `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&page=${pageNum}`
            : `https://api.themoviedb.org/3/tv/${cat}?api_key=${API_KEY}&page=${pageNum}`;
      }

      const res = await fetch(endpoint);
      
      if (!res.ok) throw new Error("Failed to fetch");
      
      const data = await res.json();
      
      if (pageNum === 1) {
        setMovies(data.results || []);
        setFeatured(data.results?.[0] || null);
      } else {
        setMovies(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMore(pageNum < data.total_pages);
      setPage(pageNum);
      
    } catch (err) {
      setError(errorMessages[err.message] || errorMessages.default);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [type, errorMessages]);

  // ================= FIXED: Load More Function with useCallback =================
  const handleLoadMore = useCallback(() => {
    if (category === "trending") {
      fetchTrending(page + 1);
    } else {
      fetchByCategory(category, page + 1);
    }
  }, [category, page, fetchTrending, fetchByCategory]);

  // ================= Intersection Observer for Auto Load =================
  useEffect(() => {
    if (loading || !hasMore || search.trim()) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        handleLoadMore();
      }
    });

    if (lastMovieRef.current) {
      observerRef.current.observe(lastMovieRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, hasMore, search, handleLoadMore]);

  // ================= Search Functions =================
  const fetchSearchSuggestions = useCallback(async (query) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
      );
      
      const data = await res.json();
      setSuggestions(data.results?.slice(0, 5) || []);
    } catch (err) {
      setSuggestions([]);
    }
  }, [type]);

  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSuggestions([]);
      setIsSearching(false);
      setSearch("");
      setPage(1);
      setHasMore(true);
      category === "trending" ? fetchTrending() : fetchByCategory(category);
      return;
    }

    try {
      setIsSearching(true);
      setLoading(true);
      setError(null);
      
      const endpoint = `https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      
      const res = await fetch(endpoint);
      
      if (!res.ok) throw new Error("Search failed");
      
      const data = await res.json();
      setSearchResults(data.results || []);
      setSuggestions([]);
      setFeatured(null);
      setMovies([]);
      setPage(1);
      setHasMore(false);
      
    } catch (err) {
      setError(errorMessages[err.message] || errorMessages.default);
      setSearchResults([]);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  }, [type, category, fetchTrending, fetchByCategory, errorMessages]);

  // ================= Enhanced Search Handler =================
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (!value.trim()) {
      setSearchResults([]);
      setSuggestions([]);
      setIsSearching(false);
      setPage(1);
      setHasMore(true);
      category === "trending" ? fetchTrending() : fetchByCategory(category);
      return;
    }
    
    if (value.trim().length >= 2) {
      setIsSearching(true);
      
      // Debounced search suggestions
      typingTimeoutRef.current = setTimeout(() => {
        fetchSearchSuggestions(value);
      }, 300);
      
      // Debounced full search
      typingTimeoutRef.current = setTimeout(() => {
        performSearch(value);
        
        // Load ads after search (with a small delay)
        setTimeout(() => {
          loadPopAds();
        }, 1000);
      }, 500);
    }
  };

  // ================= Keyboard Navigation =================
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Escape':
        handleClearSearch();
        break;
      case 'Enter':
        if (search.trim()) {
          performSearch(search);
        }
        break;
      default:
        break;
    }
  };

  // ================= Load Data on Mount & Category Change =================
  useEffect(() => {
    if (!search) {
      setPage(1);
      setHasMore(true);
      category === "trending" ? fetchTrending() : fetchByCategory(category);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [category, type, search, fetchTrending, fetchByCategory]);

  // ================= Local Storage for Preferences =================
  useEffect(() => {
    const preferences = {
      type,
      category,
      lastSearch: search
    };
    localStorage.setItem('moviehouse_prefs', JSON.stringify(preferences));
  }, [type, category, search]);

  useEffect(() => {
    const saved = localStorage.getItem('moviehouse_prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        setType(prefs.type || 'movie');
        setCategory(prefs.category || 'trending');
        if (prefs.lastSearch && prefs.lastSearch.trim()) {
          setSearch(prefs.lastSearch);
          // Don't auto-search on load, just restore the search term
        }
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
  }, []);

  const handleClearSearch = () => {
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setIsSearching(false);
    setPage(1);
    setHasMore(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    category === "trending" ? fetchTrending() : fetchByCategory(category);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSuggestionClick = (item) => {
    setSearch(item.title || item.name);
    performSearch(item.title || item.name);
  };

  const startWatching = (item) => {
    if (!item?.id) return;
    
    // Load ads when user clicks to watch
    loadPopAds();
    
    // Then proceed to load the movie
    setTimeout(() => {
      const url = type === "movie"
        ? `https://vidsrc.to/embed/movie/${item.id}`
        : `https://vidsrc.to/embed/tv/${item.id}`;
      setWatchUrl(url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);
  };

  const resetToHome = () => {
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setIsSearching(false);
    setPage(1);
    setHasMore(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setCategory("trending");
    setWatchUrl(null);
    fetchTrending();
  };

  // ================= NEW: Handle category change =================
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
    setHasMore(true);
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    
    // Load ads when changing categories (with small delay)
    setTimeout(() => {
      loadPopAds();
    }, 1000);
  };

  // ================= Handle type change (Movie/TV) =================
  const handleTypeChange = (newType) => {
    setType(newType);
    handleClearSearch();
    setPage(1);
    setHasMore(true);
    
    // Load ads when switching between movies and TV shows
    setTimeout(() => {
      loadPopAds();
    }, 1000);
  };

  const displayMovies = search.trim() ? searchResults : movies;
  const heroImage = featured?.backdrop_path || featured?.poster_path
    ? `${IMG}${featured.backdrop_path || featured.poster_path}`
    : "";

  // ================= Loading Skeleton =================
  const MovieSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-gray-800 rounded-xl aspect-[2/3] mb-2"></div>
      <div className="h-4 bg-gray-800 rounded mb-2"></div>
      <div className="h-3 bg-gray-800 rounded w-1/2"></div>
    </div>
  );

  // ================= Document Title Hook =================
  useEffect(() => {
    const title = search.trim() 
      ? `Search: "${search}" - MovieHouse`
      : watchUrl 
        ? `Watching - MovieHouse`
        : category === "filipino"
          ? `Tagalog Movies - MovieHouse`
          : `${categoryLabels[category]} ${type === "movie" ? "Movies" : "TV Shows"} - MovieHouse`;
    
    document.title = title;
  }, [search, watchUrl, category, type, categoryLabels]);

  // ================= Cleanup on unmount =================
  useEffect(() => {
    return () => {
      // Clean up ad scripts on unmount
      const adScripts = document.querySelectorAll('script[type="text/javascript"]');
      adScripts.forEach(script => {
        const scriptContent = script.textContent || script.innerHTML;
        if (scriptContent && scriptContent.includes('a8876ec4588517dc1fe664b0e6812854')) {
          script.remove();
        }
      });
    };
  }, []);

  return (
    <div className="bg-black text-white min-h-screen">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/95 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-900">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1
            onClick={resetToHome}
            className="text-2xl md:text-3xl font-bold cursor-pointer hover:text-red-500 whitespace-nowrap transition-colors duration-300"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && resetToHome()}
          >
            🎬 Movie<span className="text-red-600">House</span>
          </h1>
          
          <div className="relative flex-1 md:flex-none md:w-64 lg:w-80 flex items-center">
            <div className="relative w-full">
              <input
                ref={searchInputRef}
                className="bg-gray-900/80 px-4 py-2 rounded-full w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 pr-10"
                placeholder="Search movies or TV shows..."
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                type="text"
                aria-label="Search movies or TV shows"
                aria-describedby="search-description"
              />
              
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {search ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-white transition-colors duration-300"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <span className="text-gray-400" aria-hidden="true">🔍</span>
                )}
              </div>
              
              {isSearching && search.trim().length >= 2 && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              
              {/* Search Suggestions */}
              {suggestions.length > 0 && search.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg overflow-hidden z-50 border border-gray-700">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 transition-colors duration-200"
                      onClick={() => handleSuggestionClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(item)}
                    >
                      <img
                        src={item.poster_path ? `${IMG}w92${item.poster_path}` : "https://via.placeholder.com/46x69/111/666"}
                        alt=""
                        className="w-10 h-15 object-cover rounded"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="font-medium truncate">{item.title || item.name}</p>
                        <p className="text-gray-400 text-xs">
                          {item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || "Unknown"}
                          {item.vote_average && ` • ⭐ ${item.vote_average.toFixed(1)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p id="search-description" className="sr-only">
              Search for movies or TV shows by title. Start typing to see suggestions.
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleTypeChange("movie")}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              type === "movie" ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-pressed={type === "movie"}
          >
            Movies
          </button>
          <button
            onClick={() => handleTypeChange("tv")}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              type === "tv" ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-pressed={type === "tv"}
          >
            TV Shows
          </button>
        </div>
      </nav>

      <div className="pt-24 md:pt-28">
        {search.trim() && (
          <div className="px-4 md:px-6 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-bold">
                {isSearching ? (
                  <span className="text-gray-400">Searching for "{search}"...</span>
                ) : (
                  <>
                    Search Results for "{search}"
                    {searchResults.length > 0 && (
                      <span className="text-gray-400 text-base ml-2">
                        ({searchResults.length} results)
                      </span>
                    )}
                  </>
                )}
              </h2>
              {search && !isSearching && (
                <button
                  onClick={handleClearSearch}
                  className="text-gray-400 hover:text-white text-sm transition-colors duration-300"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        )}

        {!watchUrl && !search.trim() && (
          <div className="px-4 md:px-6 mb-6 md:mb-8">
            <div className="flex flex-wrap gap-2 md:gap-3">
              {Object.keys(categoryLabels).map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
                    category === cat ? (
                      cat === "filipino" ? "bg-green-600" : 
                      cat === "action" ? "bg-orange-600" :
                      cat === "comedy" ? "bg-yellow-600" :
                      cat === "drama" ? "bg-purple-600" :
                      cat === "horror" ? "bg-gray-700" :
                      cat === "romance" ? "bg-pink-600" :
                      cat === "thriller" ? "bg-indigo-600" :
                      cat === "scifi" ? "bg-blue-600" :
                      cat === "animation" ? "bg-teal-600" :
                      "bg-red-600"
                    ) : "bg-gray-900 hover:bg-gray-800"
                  }`}
                  aria-pressed={category === cat}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>
        )}

        {watchUrl ? (
          <div className="px-4 md:px-6">
            <button
              onClick={() => setWatchUrl(null)}
              className="mb-4 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors duration-300"
              aria-label="Back to movie list"
            >
              ← Back
            </button>
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <iframe
                src={watchUrl}
                title="Video player"
                allowFullScreen
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        ) : (
          <>
            {featured && !search.trim() && (
              <div 
                className="relative h-[50vh] md:h-[70vh] bg-cover bg-center mb-8 md:mb-12"
                style={{ 
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${heroImage})` 
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                  <div className="max-w-3xl">
                    <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4">
                      {featured.title || featured.name}
                    </h1>
                    <p className="text-gray-300 mb-4 md:mb-6 line-clamp-2 md:line-clamp-3 text-sm md:text-base">
                      {featured.overview}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => startWatching(featured)}
                        className="bg-red-600 hover:bg-red-700 px-5 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors duration-300"
                        aria-label={`Play ${featured.title || featured.name}`}
                      >
                        ▶ Play Now
                      </button>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span className="bg-gray-900/80 px-3 py-1 rounded-full">
                          ⭐ {featured.vote_average?.toFixed(1)}
                        </span>
                        <span>
                          {featured.release_date?.substring(0,4) || featured.first_air_date?.substring(0,4)}
                          {(featured.original_language === 'tl' || 
                            (featured.origin_country && featured.origin_country.includes('PH'))) && 
                            <span className="ml-2 text-green-500">Tagalog</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading && !search.trim() && page === 1 ? (
              <div className="px-4 md:px-6">
                <h2 className="text-xl md:text-2xl font-bold mb-6">
                  {category === "filipino" ? (
                    <span>
                      Loading Tagalog Movies
                    </span>
                  ) : (
                    `Loading ${categoryLabels[category]} ${type === "movie" ? "Movies" : "TV Shows"}...`
                  )}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {[...Array(12)].map((_, i) => (
                    <MovieSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : !loading && !error && displayMovies.length > 0 && (
              <div className="px-4 md:px-6">
                {!search.trim() && (
                  <h2 className="text-xl md:text-2xl font-bold mb-6">
                    {category === "filipino" ? (
                      <span>
                        Tagalog Movies
                      </span>
                    ) : (
                      `${categoryLabels[category]} ${type === "movie" ? "Movies" : "TV Shows"}`
                    )}
                    <span className="text-gray-400 text-base ml-2">
                      ({displayMovies.length} movies)
                    </span>
                  </h2>
                )}
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {displayMovies.map((item, index) => (
                    <div 
                      ref={index === displayMovies.length - 1 ? lastMovieRef : null}
                      key={`${item.id}-${item.title || item.name}`}
                    >
                      <MovieItem
                        item={item}
                        type={type}
                        onClick={startWatching}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Load More Section */}
                {!search.trim() && hasMore && (
                  <div className="text-center mt-8">
                    <p className="text-gray-400 mb-2">
                      Showing {movies.length} of {page * 20} results • Page {page}
                    </p>
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Loading..." : "Load More Movies"}
                    </button>
                  </div>
                )}
                
                {/* Tagalog movies note */}
                {category === "filipino" && displayMovies.length > 0 && (
                  <div className="mt-8 p-4 bg-green-900/30 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">About Tagalog Movies</h3>
                    </div>
                    <p className="text-gray-300 text-sm">
                      These are movies originally in Tagalog (Filipino language) or produced in the Philippines. 
                      Enjoy authentic Filipino cinema with local stories and culture.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && search.trim() && searchResults.length === 0 && !isSearching && (
              <div className="text-center py-20">
                <div className="text-gray-500 text-6xl mb-4" aria-hidden="true">🔍</div>
                <p className="text-xl font-medium mb-2">No results found for "{search}"</p>
                <button
                  onClick={handleClearSearch}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors duration-300"
                >
                  Clear Search
                </button>
              </div>
            )}
          </>
        )}

        {loading && (search.trim() || watchUrl) && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-gray-400">
              {search.trim() ? "Searching..." : `Loading ${type === "movie" ? "movies" : "TV shows"}...`}
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <div className="text-red-400 text-6xl mb-4" aria-hidden="true">⚠️</div>
            <p className="text-xl font-medium mb-2">{error}</p>
            <button
              onClick={fetchTrending}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors duration-300"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* SIMPLE DISCLAIMER */}
      <footer className="mt-12 border-t border-gray-900 py-8">
        <div className="px-4 md:px-6 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-600/20 rounded-full mb-3">
              <span className="text-2xl" aria-hidden="true">⚠️</span>
            </div>
            <h3 className="text-xl font-bold mb-2">LEGAL DISCLAIMER</h3>
          </div>
          
          <div className="bg-gray-900/50 p-6 rounded-lg">
            <div className="space-y-4">
              <p className="text-gray-300">
                <strong>MovieHouse is a content indexing platform only.</strong> We do not host, upload, cache, or distribute any copyrighted material.
              </p>
              
              <p className="text-gray-300">
                All media links are automatically gathered from third-party websites that are not under our control. MovieHouse is not responsible for the content, legality, or copyright compliance of any external sources.
              </p>
              
              <p className="text-gray-300">
                Under no circumstances shall MovieHouse be held liable for any copyright infringement claims. All copyright issues must be addressed to the original content hosts.
              </p>
              
              <p className="text-gray-300">
                Use of this website is at your own risk. By accessing this site, you agree that MovieHouse bears no responsibility for external content.
              </p>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-gray-400 text-sm text-center">
                Movie information provided by The Movie Database (TMDB)
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ================= Wrapped App with Error Boundary =================
export default function AppWrapper() {
  return (
    <SimpleErrorBoundary>
      <App />
    </SimpleErrorBoundary>
  );
}
