import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

const API_KEY = process.env.REACT_APP_TMDB_API_KEY;

// ================= WORKING IMAGE UTILITIES =================
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

const imageSizes = {
  thumbnail: "w92",
  small: "w154",
  card: "w342",
  medium: "w500",
  large: "w780",
  xlarge: "w1280",
  original: "original"
};

const getImageUrl = (path, size = "card") => {
  if (!path || typeof path !== 'string' || path.trim() === '' || path === 'null') {
    return null;
  }
  
  const sizeString = imageSizes[size] || imageSizes.card;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}${sizeString}${cleanPath}`;
};

const getBackdropImage = (path) => {
  if (!path) return null;
  return getImageUrl(path, "large");
};

// ================= SIMPLE IMAGE COMPONENT =================
const OptimizedImage = React.memo(({ 
  src, 
  alt, 
  size = "card",
  className = "",
  lazy = true,
  priority = false,
  ...props 
}) => {
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy || priority);
  const imgRef = useRef();
  
  const imageUrl = getImageUrl(src, size);
  
  useEffect(() => {
    if (!lazy || priority || isVisible || !imageUrl) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, [lazy, priority, isVisible, imageUrl]);
  
  if (!imageUrl || hasError) {
    return (
      <div 
        ref={imgRef}
        className={`${className} bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl aspect-[2/3] flex flex-col items-center justify-center`}
        style={{ aspectRatio: '2/3' }}
      >
        <div className="text-gray-500 text-4xl mb-3">🎬</div>
        <p className="text-gray-400 text-sm">No poster</p>
      </div>
    );
  }
  
  if (!isVisible && lazy && !priority) {
    return (
      <div 
        ref={imgRef}
        className={`${className} bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl aspect-[2/3] animate-pulse`}
        style={{ aspectRatio: '2/3' }}
      />
    );
  }
  
  return (
    <img
      ref={imgRef}
      src={imageUrl}
      alt={alt || "Movie poster"}
      loading={lazy && !priority ? "lazy" : "eager"}
      decoding="async"
      className={`${className} rounded-xl w-full h-full object-cover`}
      style={{ aspectRatio: '2/3' }}
      onError={() => setHasError(true)}
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// ================= Helper Functions =================
const formatRuntime = (minutes) => {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

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

// ================= Movie/TV Item Component =================
const MovieItem = React.memo(({ item, type, onClick }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleClick = () => onClick(item);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(item);
    }
  };
  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowFullDescription(!showFullDescription);
  };

  const isTagalog = item.original_language === 'tl' || 
                   (item.origin_country && item.origin_country.includes('PH')) ||
                   (item.production_countries && item.production_countries.some(country => country.iso_3166_1 === 'PH'));

  const truncatedDescription = item.overview 
    ? (showFullDescription ? item.overview : item.overview.substring(0, 80) + '...')
    : 'No description available';

  const renderTVShowInfo = () => {
    if (type !== "tv") return null;
    
    return (
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {item.first_air_date && <span>📅 {item.first_air_date.substring(0, 4)}</span>}
          {item.number_of_seasons && <span>• {item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>}
          {item.number_of_episodes && <span>• {item.number_of_episodes} Episodes</span>}
          {item.episode_run_time?.[0] && <span>• {item.episode_run_time[0]}m</span>}
        </div>
        
        {item.status && (
          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
            item.status === 'Returning Series' ? 'bg-green-900/30 text-green-400' :
            item.status === 'Ended' ? 'bg-red-900/30 text-red-400' :
            'bg-gray-800 text-gray-300'
          }`}>
            {item.status}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black rounded-xl"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Watch ${item.title || item.name}${isTagalog ? ' (Tagalog)' : ''}`}
    >
      <div className="relative overflow-hidden rounded-xl aspect-[2/3] mb-2">
        <OptimizedImage
          src={item.poster_path}
          alt={`Poster for ${item.title || item.name}`}
          size="card"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          lazy={true}
        />
        
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity duration-300">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-red-600 rounded-full flex items-center justify-center">
            <span className="text-lg md:text-xl ml-1">▶</span>
          </div>
        </div>
        
        <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-full text-xs font-bold">
          ⭐ {item.vote_average?.toFixed(1) || "N/A"}
        </div>
        
        {isTagalog && (
          <div className="absolute top-2 left-2 bg-green-600 px-2 py-1 rounded-full text-xs font-bold">
            Tagalog
          </div>
        )}
      </div>
      
      <h3 className="font-bold text-sm md:text-base truncate group-hover:text-red-400 transition-colors duration-300 mb-1">
        {item.title || item.name}
      </h3>
      
      {renderTVShowInfo()}
      
      <div className="space-y-2">
        {type === "movie" && (
          <p className="text-gray-400 text-xs md:text-sm">
            {item.release_date?.substring(0,4) || "Unknown"}
            {item.runtime && <span className="ml-2">• {formatRuntime(item.runtime)}</span>}
          </p>
        )}
        
        <div className="text-gray-300 text-xs">
          <p className={`${!showFullDescription ? 'line-clamp-2' : ''} mb-1`}>
            {truncatedDescription}
          </p>
          {item.overview && item.overview.length > 80 && (
            <button
              onClick={toggleDescription}
              className="text-red-400 hover:text-red-300 text-xs transition-colors duration-300"
              aria-expanded={showFullDescription}
            >
              {showFullDescription ? 'Show Less' : 'Read More'}
            </button>
          )}
        </div>
        
        {item.credits?.cast?.slice(0, 2).length > 0 && (
          <p className="text-xs text-gray-500 truncate">
            With: {item.credits.cast.slice(0, 2).map(p => p.name).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
});

MovieItem.displayName = 'MovieItem';

// ================= Main App Component =================
function App() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [category, setCategory] = useState("trending");
  const [search, setSearch] = useState("");
  const [watchUrl, setWatchUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  const [selectedTVShow, setSelectedTVShow] = useState(null);
  const [showTVDetails, setShowTVDetails] = useState(false);
  const [showTVSeriesPage, setShowTVSeriesPage] = useState(false);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastMovieRef = useRef();
  const observerRef = useRef();

  // ================= Categories =================
  const movieCategoryLabels = useMemo(() => ({
    trending: "🔥 Trending",
    popular: "⭐ Popular", 
    top_rated: "🏆 Top Rated",
    upcoming: "📅 Upcoming",
    now_playing: "🎬 Now Playing",
    filipino: "🎭 Tagalog Movie",
    action: "💥 Action",
    comedy: "😂 Comedy", 
    drama: "🎭 Drama",
    horror: "👻 Horror",
    romance: "❤️ Romance",
    thriller: "🔪 Thriller",
    scifi: "🚀 Sci-Fi",
    animation: "🐭 Animation"
  }), []);

  const tvCategoryLabels = useMemo(() => ({
    popular_tv: "🔥 Popular TV",
    top_rated_tv: "🏆 Top Rated TV",
    on_the_air: "📺 On The Air",
    airing_today: "🎬 Airing Today",
    tv_action: "💥 Action & Adventure",
    tv_comedy: "😂 Comedy",
    tv_drama: "🎭 Drama",
    tv_scifi: "🚀 Sci-Fi & Fantasy",
    tv_animation: "🐭 Animation",
    tagalog_tv: "🇵🇭 Tagalog TV",
    tv_mystery: "🔍 Mystery",
    tv_reality: "🎤 Reality",
    tv_documentary: "📚 Documentary"
  }), []);

  const currentCategoryLabels = showTVSeriesPage ? tvCategoryLabels : movieCategoryLabels;

  // ================= API Functions =================
  const fetchTrending = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const url = `https://api.themoviedb.org/3/trending/${showTVSeriesPage ? 'tv' : 'movie'}/week?api_key=${API_KEY}&page=${pageNum}`;
      
      const res = await fetch(url);
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
      console.error('Fetch error:', err);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [showTVSeriesPage]);

  const fetchByCategory = useCallback(async (cat, pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = "";
      
      if (showTVSeriesPage) {
        const tvCatMap = {
          'popular_tv': 'popular',
          'top_rated_tv': 'top_rated',
          'on_the_air': 'on_the_air',
          'airing_today': 'airing_today',
          'tv_action': 10759,
          'tv_comedy': 35,
          'tv_drama': 18,
          'tv_scifi': 10765,
          'tv_animation': 16,
          'tagalog_tv': 'tagalog_tv',
          'tv_mystery': 9648,
          'tv_reality': 10764,
          'tv_documentary': 99
        };
        
        const tvCat = tvCatMap[cat];
        
        if (typeof tvCat === 'number') {
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=${tvCat}&sort_by=popularity.desc&page=${pageNum}`;
        } else if (tvCat === 'tagalog_tv') {
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=tl&sort_by=popularity.desc&page=${pageNum}`;
        } else {
          endpoint = `https://api.themoviedb.org/3/tv/${tvCat}?api_key=${API_KEY}&page=${pageNum}`;
        }
      } else {
        if (cat === "filipino") {
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_original_language=tl&region=PH&sort_by=popularity.desc&page=${pageNum}`;
        }
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
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}`;
        }
        else {
          endpoint = `https://api.themoviedb.org/3/movie/${cat}?api_key=${API_KEY}&page=${pageNum}`;
        }
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
      console.error("Fetch error:", err);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [showTVSeriesPage]);

  // ================= Load More Function =================
  const handleLoadMore = useCallback(() => {
    if (category === "trending") {
      fetchTrending(page + 1);
    } else {
      fetchByCategory(category, page + 1);
    }
  }, [category, page, fetchTrending, fetchByCategory]);

  // ================= Intersection Observer =================
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
      const currentType = showTVSeriesPage ? 'tv' : 'movie';
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
      );
      
      const data = await res.json();
      setSuggestions(data.results?.slice(0, 5) || []);
    } catch (err) {
      setSuggestions([]);
    }
  }, [showTVSeriesPage]);

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
      
      const currentType = showTVSeriesPage ? 'tv' : 'movie';
      const endpoint = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      
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
      setError('Search failed');
      setSearchResults([]);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  }, [showTVSeriesPage, category, fetchTrending, fetchByCategory]);

  // ================= Search Handler =================
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
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
      
      typingTimeoutRef.current = setTimeout(() => {
        fetchSearchSuggestions(value);
      }, 300);
      
      typingTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    }
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Escape':
        handleClearSearch();
        break;
      case 'Enter':
        if (search.trim()) performSearch(search);
        break;
      default:
        break;
    }
  };

  // ================= Load Data =================
  useEffect(() => {
    if (!search) {
      setPage(1);
      setHasMore(true);
      category === "trending" ? fetchTrending() : fetchByCategory(category);
    }
    
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [category, showTVSeriesPage, search, fetchTrending, fetchByCategory]);

  const handleClearSearch = () => {
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setIsSearching(false);
    setPage(1);
    setHasMore(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    category === "trending" ? fetchTrending() : fetchByCategory(category);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleSuggestionClick = (item) => {
    setSearch(item.title || item.name);
    performSearch(item.title || item.name);
  };

  // ================= Watch Function =================
  const startWatching = (item) => {
    if (!item?.id) return;
    
    if (showTVSeriesPage) {
      setSelectedTVShow(item);
      setShowTVDetails(true);
      return;
    }
    
    const url = `https://vidsrc.to/embed/movie/${item.id}`;
    setWatchUrl(url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const displayMovies = search.trim() ? searchResults : movies;
  const heroImage = featured?.backdrop_path || featured?.poster_path
    ? getBackdropImage(featured.backdrop_path || featured.poster_path)
    : "";

  // ================= Loading Skeleton =================
  const MovieSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl aspect-[2/3] mb-2"></div>
      <div className="h-4 bg-gray-800 rounded mb-2"></div>
      <div className="h-3 bg-gray-800 rounded w-1/2"></div>
    </div>
  );

  return (
    <div className="bg-black text-white min-h-screen">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/95 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-900">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1
            onClick={() => {
              setSearch("");
              setSearchResults([]);
              setWatchUrl(null);
              setShowTVDetails(false);
              setCategory("trending");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-2xl md:text-3xl font-bold cursor-pointer hover:text-red-500 whitespace-nowrap transition-colors duration-300"
            role="button"
            tabIndex={0}
          >
            🎬 Movie<span className="text-red-600">House</span>
          </h1>
          
          <div className="relative flex-1 md:flex-none md:w-64 lg:w-80 flex items-center">
            <div className="relative w-full">
              <input
                ref={searchInputRef}
                className="bg-gray-900/80 px-4 py-2 rounded-full w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 pr-10"
                placeholder={showTVSeriesPage ? "Search TV shows..." : "Search movies..."}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                type="text"
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
              
              {suggestions.length > 0 && search.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg overflow-hidden z-50 border border-gray-700">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-start gap-3 transition-colors duration-200"
                      onClick={() => handleSuggestionClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(item)}
                    >
                      <OptimizedImage
                        src={item.poster_path}
                        alt=""
                        size="thumbnail"
                        className="w-10 h-15 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title || item.name}</p>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                          {item.overview || 'No description available'}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || "Unknown"}
                          {item.vote_average && ` • ⭐ ${item.vote_average.toFixed(1)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowTVSeriesPage(false);
              setCategory("trending");
              setSearch("");
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              !showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            🎬 Movies
          </button>
          <button
            onClick={() => {
              setShowTVSeriesPage(true);
              setCategory("popular_tv");
              setSearch("");
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            📺 TV Series
          </button>
        </div>
      </nav>

      <div className="pt-24 md:pt-28">
        {!watchUrl && !search.trim() && !showTVDetails && (
          <div className="px-4 md:px-6 mb-6 md:mb-8">
            <div className="flex flex-wrap gap-2 md:gap-3">
              {Object.keys(currentCategoryLabels).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setPage(1);
                    setHasMore(true);
                    setSearch("");
                    setSearchResults([]);
                    setSuggestions([]);
                  }}
                  className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
                    category === cat ? (
                      cat === "filipino" || cat === "tagalog_tv" ? "bg-green-600" : 
                      cat.includes("action") ? "bg-orange-600" :
                      cat.includes("comedy") ? "bg-yellow-600" :
                      cat.includes("drama") ? "bg-purple-600" :
                      cat.includes("horror") ? "bg-gray-700" :
                      cat.includes("romance") ? "bg-pink-600" :
                      cat.includes("thriller") ? "bg-indigo-600" :
                      cat.includes("scifi") ? "bg-blue-600" :
                      cat.includes("animation") ? "bg-teal-600" :
                      "bg-red-600"
                    ) : "bg-gray-900 hover:bg-gray-800"
                  }`}
                >
                  {currentCategoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>
        )}

        {watchUrl ? (
          <div className="px-4 md:px-6">
            <button
              onClick={() => {
                setWatchUrl(null);
                if (showTVSeriesPage && selectedTVShow) {
                  setShowTVDetails(true);
                }
              }}
              className="mb-4 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors duration-300 flex items-center gap-2"
            >
              ← Back {showTVSeriesPage ? "to Episodes" : "to List"}
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
            {featured && !search.trim() && !showTVDetails && (
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
                    
                    <div className="text-gray-300 mb-4 md:mb-6">
                      <p className="text-sm md:text-base line-clamp-3">
                        {featured.overview || "No description available."}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => startWatching(featured)}
                        className="bg-red-600 hover:bg-red-700 px-5 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors duration-300 flex items-center gap-2"
                      >
                        <span>▶</span> {showTVSeriesPage ? "Browse Episodes" : "Play Now"}
                      </button>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span className="bg-gray-900/80 px-3 py-1 rounded-full">
                          ⭐ {featured.vote_average?.toFixed(1)}
                        </span>
                        <span>
                          {featured.release_date?.substring(0,4) || featured.first_air_date?.substring(0,4)}
                        </span>
                        {!showTVSeriesPage && (
                          <span className="text-gray-400">• {formatRuntime(featured.runtime || "N/A")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading && !search.trim() && page === 1 ? (
              <div className="px-4 md:px-6">
                <h2 className="text-xl md:text-2xl font-bold mb-6">
                  {showTVSeriesPage ? `Loading ${currentCategoryLabels[category]}...` : `Loading ${currentCategoryLabels[category]}...`}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {[...Array(12)].map((_, i) => (
                    <MovieSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : !loading && !error && displayMovies.length > 0 && !showTVDetails && (
              <div className="px-4 md:px-6">
                {!search.trim() && (
                  <h2 className="text-xl md:text-2xl font-bold mb-6">
                    {showTVSeriesPage ? currentCategoryLabels[category] : currentCategoryLabels[category]}
                    <span className="text-gray-400 text-base ml-2">
                      ({displayMovies.length} {showTVSeriesPage ? 'TV shows' : 'movies'})
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
                        type={showTVSeriesPage ? "tv" : "movie"}
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
                      {loading ? "Loading..." : "Load More"}
                    </button>
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

        {loading && (search.trim() || showTVDetails) && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-gray-400">
              {search.trim() ? "Searching..." : `Loading ${showTVSeriesPage ? 'TV shows' : 'movies'}...`}
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
