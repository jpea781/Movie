import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

// ================= API CONFIGURATION =================
// IMPORTANT: Create a .env.local file with REACT_APP_TMDB_API_KEY=your_key_here
// For production, you MUST use a backend proxy to hide your API key
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

// ================= DEBOUNCE UTILITY =================
const createDebounce = () => {
  let timeoutId;
  return (func, delay) => {
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };
};

// ================= TYPE GUARDS =================
const isValidMediaItem = (item) => {
  return item && typeof item === 'object' && item.id && (item.title || item.name);
};

const isValidSeason = (season) => {
  return season && typeof season === 'object' && season.id && season.season_number !== undefined;
};

const isValidEpisode = (episode) => {
  return episode && typeof episode === 'object' && episode.id && episode.episode_number !== undefined;
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy || priority);
  const [isClient, setIsClient] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);
  
  const imageUrl = getImageUrl(src, size);
  
  useEffect(() => {
    setIsClient(true);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (!isClient || !lazy || priority || isVisible || !imageUrl) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
          }
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isClient, lazy, priority, isVisible, imageUrl]);
  
  const handleLoad = () => {
    setIsLoaded(true);
  };
  
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };
  
  if (!imageUrl || hasError) {
    return (
      <div 
        ref={imgRef}
        className={`${className} bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl aspect-[2/3] flex flex-col items-center justify-center`}
        style={{ aspectRatio: '2/3' }}
        role="img"
        aria-label={alt || "No poster available"}
      >
        <div className="text-gray-500 text-4xl mb-3">🎬</div>
        <p className="text-gray-400 text-sm">No poster</p>
      </div>
    );
  }
  
  if (!isVisible && lazy && !priority && isClient) {
    return (
      <div 
        ref={imgRef}
        className={`${className} relative rounded-xl aspect-[2/3] overflow-hidden`}
        style={{ aspectRatio: '2/3' }}
      >
        <div 
          className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear'
          }}
        />
      </div>
    );
  }
  
  return (
    <div className={`${className} relative`} style={{ aspectRatio: '2/3' }}>
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 rounded-xl"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear'
          }}
        />
      )}
      <img
        ref={imgRef}
        src={imageUrl}
        alt={alt || "Movie poster"}
        loading={lazy && !priority ? "lazy" : "eager"}
        decoding="async"
        className={`absolute inset-0 w-full h-full object-cover rounded-xl transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// ================= TV SHOW DETAILS MODAL =================
const TVShowDetailsModal = React.memo(({ 
  show, 
  onClose, 
  onEpisodeSelect,
  isOpen 
}) => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState({ seasons: false, episodes: false });
  const [error, setError] = useState({ seasons: null, episodes: null });
  
  // Define fetchEpisodes inside the component to avoid dependency issues
  const fetchEpisodes = useCallback(async (seasonNumber) => {
    try {
      setLoading(prev => ({ ...prev, episodes: true }));
      setError(prev => ({ ...prev, episodes: null }));
      
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${show.id}/season/${seasonNumber}?api_key=${API_KEY}`
      );
      
      if (!res.ok) {
        throw new Error(`Failed to load episodes: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.episodes && Array.isArray(data.episodes)) {
        const validEpisodes = data.episodes.filter(isValidEpisode);
        setEpisodes(validEpisodes);
      } else {
        setEpisodes([]);
      }
      
      setSelectedSeason(seasonNumber);
    } catch (err) {
      console.error('Error fetching episodes:', err);
      setError(prev => ({ ...prev, episodes: 'Failed to load episodes. Please try again.' }));
      setEpisodes([]);
    } finally {
      setLoading(prev => ({ ...prev, episodes: false }));
    }
  }, [show?.id]); // Only depend on show.id

  useEffect(() => {
    if (!show || !isOpen) return;
    
    const fetchSeasons = async () => {
      try {
        setLoading(prev => ({ ...prev, seasons: true }));
        setError(prev => ({ ...prev, seasons: null }));
        
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${show.id}?api_key=${API_KEY}&append_to_response=credits`
        );
        
        if (!res.ok) {
          throw new Error(`Failed to load seasons: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.seasons && Array.isArray(data.seasons)) {
          const validSeasons = data.seasons
            .filter(s => isValidSeason(s) && s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);
          
          setSeasons(validSeasons);
          
          if (validSeasons.length > 0) {
            await fetchEpisodes(validSeasons[0].season_number);
          }
        } else {
          setSeasons([]);
        }
      } catch (err) {
        console.error('Error fetching seasons:', err);
        setError(prev => ({ ...prev, seasons: 'Failed to load seasons. Please try again.' }));
        setSeasons([]);
      } finally {
        setLoading(prev => ({ ...prev, seasons: false }));
      }
    };
    
    fetchSeasons();
  }, [show, isOpen, fetchEpisodes]); // Added fetchEpisodes to dependencies
  
  if (!isOpen || !show) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-between items-center p-6 bg-gradient-to-b from-gray-900 to-transparent">
          <h2 id="modal-title" className="text-2xl md:text-3xl font-bold">{show.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="lg:w-1/3">
              <OptimizedImage
                src={show.poster_path}
                alt={show.name}
                size="medium"
                className="w-full rounded-xl"
              />
            </div>
            
            <div className="lg:w-2/3">
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">Overview</h3>
                <p className="text-gray-300">{show.overview || 'No description available.'}</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Rating</p>
                  <p className="text-xl font-bold">⭐ {show.vote_average?.toFixed(1) || 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">First Aired</p>
                  <p className="text-xl font-bold">{show.first_air_date?.substring(0,4) || 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Seasons</p>
                  <p className="text-xl font-bold">{show.number_of_seasons || 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Episodes</p>
                  <p className="text-xl font-bold">{show.number_of_episodes || 'N/A'}</p>
                </div>
              </div>
              
              {loading.seasons ? (
                <div className="mb-6">
                  <div className="h-6 bg-gray-800 rounded w-1/4 mb-3 animate-pulse"></div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-10 bg-gray-800 rounded-full w-20 animate-pulse"></div>
                    ))}
                  </div>
                </div>
              ) : error.seasons ? (
                <div className="mb-6 p-4 bg-red-900/20 rounded-lg">
                  <p className="text-red-400">{error.seasons}</p>
                </div>
              ) : seasons.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-3">Seasons</h3>
                  <div className="flex flex-wrap gap-2">
                    {seasons.map((season) => (
                      <button
                        key={season.id}
                        onClick={() => fetchEpisodes(season.season_number)}
                        className={`px-4 py-2 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                          selectedSeason === season.season_number
                            ? 'bg-red-600'
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        Season {season.season_number}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
                  <p className="text-gray-400">No seasons available.</p>
                </div>
              )}
            </div>
          </div>
          
          {loading.episodes ? (
            <div>
              <div className="h-7 bg-gray-800 rounded w-1/3 mb-4 animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-40 bg-gray-800 rounded-xl animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : error.episodes ? (
            <div className="p-4 bg-red-900/20 rounded-lg">
              <p className="text-red-400">{error.episodes}</p>
            </div>
          ) : episodes.length > 0 ? (
            <div>
              <h3 className="text-2xl font-bold mb-4">Season {selectedSeason} Episodes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="bg-gray-800/30 rounded-xl overflow-hidden hover:bg-gray-800/50 transition-colors duration-300"
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">
                          Episode {episode.episode_number}: {episode.name}
                        </h4>
                        <span className="text-sm text-gray-400">
                          {episode.runtime || 'N/A'} min
                        </span>
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                        {episode.overview || 'No description available.'}
                      </p>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">
                          Aired: {episode.air_date || 'N/A'}
                        </span>
                        <button
                          onClick={() => onEpisodeSelect(episode)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          Watch
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-800/30 rounded-lg">
              <p className="text-gray-400">No episodes available for this season.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

TVShowDetailsModal.displayName = 'TVShowDetailsModal';

// ================= Helper Functions =================
const formatRuntime = (minutes) => {
  if (!minutes || typeof minutes !== 'number') return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// ================= Simple Error Boundary =================
class SimpleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-6xl mb-4" aria-hidden="true">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-6">{this.state.error?.message || 'Please refresh the page or try again later.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Refresh page"
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
const MovieItem = React.memo(({ item, type, onClick, onFavoriteToggle, isFavorite }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleClick = () => {
    if (isValidMediaItem(item)) {
      onClick(item);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };
  
  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowFullDescription(!showFullDescription);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    if (onFavoriteToggle && isValidMediaItem(item)) {
      onFavoriteToggle(item);
    }
  };

  const isTagalog = item.original_language === 'tl' || 
                   (item.origin_country && Array.isArray(item.origin_country) && item.origin_country.includes('PH')) ||
                   (item.production_countries && Array.isArray(item.production_countries) && 
                    item.production_countries.some(country => country.iso_3166_1 === 'PH'));

  const truncatedDescription = item.overview && typeof item.overview === 'string'
    ? (showFullDescription ? item.overview : item.overview.substring(0, 80) + (item.overview.length > 80 ? '...' : ''))
    : 'No description available';

  const renderTVShowInfo = () => {
    if (type !== "tv") return null;
    
    return (
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {item.first_air_date && <span>📅 {item.first_air_date.substring(0, 4)}</span>}
          {item.number_of_seasons && <span>• {item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>}
          {item.number_of_episodes && <span>• {item.number_of_episodes} Episodes</span>}
          {Array.isArray(item.episode_run_time) && item.episode_run_time[0] && <span>• {item.episode_run_time[0]}m</span>}
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

  if (!isValidMediaItem(item)) {
    return null;
  }

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
          ⭐ {typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : "N/A"}
        </div>
        
        {isTagalog && (
          <div className="absolute top-2 left-2 bg-green-600 px-2 py-1 rounded-full text-xs font-bold">
            Tagalog
          </div>
        )}
        
        <button
          onClick={handleFavoriteClick}
          className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 p-2 rounded-full transition-colors duration-300 z-20 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
      </div>
      
      <h3 className="font-bold text-sm md:text-base truncate group-hover:text-red-400 transition-colors duration-300 mb-1">
        {item.title || item.name}
      </h3>
      
      {renderTVShowInfo()}
      
      <div className="space-y-2">
        {type === "movie" && (
          <p className="text-gray-400 text-xs md:text-sm">
            {item.release_date?.substring(0,4) || "Unknown"}
            {typeof item.runtime === 'number' && <span className="ml-2">• {formatRuntime(item.runtime)}</span>}
          </p>
        )}
        
        <div className="text-gray-300 text-xs">
          <p className={`${!showFullDescription ? 'line-clamp-2' : ''} mb-1`}>
            {truncatedDescription}
          </p>
          {item.overview && typeof item.overview === 'string' && item.overview.length > 80 && (
            <button
              onClick={toggleDescription}
              className="text-red-400 hover:text-red-300 text-xs transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-expanded={showFullDescription}
            >
              {showFullDescription ? 'Show Less' : 'Read More'}
            </button>
          )}
        </div>
        
        {item.credits?.cast && Array.isArray(item.credits.cast) && item.credits.cast.slice(0, 2).length > 0 && (
          <p className="text-xs text-gray-500 truncate">
            With: {item.credits.cast.slice(0, 2).map(p => p.name).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
});

MovieItem.displayName = 'MovieItem';

// ================= CATEGORY BUTTONS COMPONENT =================
const CategoryButtons = React.memo(({ 
  categories, 
  currentCategory, 
  onSelect, 
  showTVSeriesPage 
}) => {
  const getButtonColor = (cat) => {
    if (cat === currentCategory) {
      if (cat === "filipino" || cat === "tagalog_tv") return "bg-green-600";
      if (cat.includes("action")) return "bg-orange-600";
      if (cat.includes("comedy")) return "bg-yellow-600";
      if (cat.includes("drama")) return "bg-purple-600";
      if (cat.includes("horror")) return "bg-gray-700";
      if (cat.includes("romance")) return "bg-pink-600";
      if (cat.includes("thriller")) return "bg-indigo-600";
      if (cat.includes("scifi")) return "bg-blue-600";
      if (cat.includes("animation")) return "bg-teal-600";
      return "bg-red-600";
    }
    return "bg-gray-900 hover:bg-gray-800";
  };

  return (
    <div className="flex flex-wrap gap-2 md:gap-3">
      {Object.keys(categories).map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${getButtonColor(cat)}`}
          aria-label={`Browse ${categories[cat]}`}
          aria-current={currentCategory === cat ? "true" : "false"}
        >
          {categories[cat]}
        </button>
      ))}
    </div>
  );
});

CategoryButtons.displayName = 'CategoryButtons';

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
  
  // Track the last selected episode to remember where to go back
  const [lastSelectedEpisode, setLastSelectedEpisode] = useState(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  
  const [favorites, setFavorites] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastMovieRef = useRef();
  const observerRef = useRef();
  const debounceRef = useRef(createDebounce());

  // ================= API Validation =================
  useEffect(() => {
    if (!API_KEY || API_KEY === 'undefined' || API_KEY === 'your_tmdb_api_key_here') {
      console.error('TMDB API key is missing or using default!');
      console.error('Please create a .env.local file with REACT_APP_TMDB_API_KEY=your_actual_key');
      setError('Configuration error: API key is missing. Please check your setup.');
    }
  }, []);

  // ================= LocalStorage Persistence =================
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('moviehouse_favorites_v2');
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.filter(isValidMediaItem));
        }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('moviehouse_favorites_v2', JSON.stringify(favorites.filter(isValidMediaItem)));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, [favorites]);

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
  const fetchTrending = useCallback(async (pageNum = 1, shouldReset = true) => {
    if (!API_KEY || API_KEY === 'undefined') return;
    
    try {
      if (shouldReset) {
        setLoading(true);
      }
      setError(null);
      const url = `https://api.themoviedb.org/3/trending/${showTVSeriesPage ? 'tv' : 'movie'}/week?api_key=${API_KEY}&page=${pageNum}&language=${selectedLanguage}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("API rate limit exceeded. Please try again later.");
        }
        throw new Error(`Failed to fetch data: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid data received from API");
      }
      
      const validResults = data.results.filter(isValidMediaItem);
      
      if (pageNum === 1 || shouldReset) {
        setMovies(validResults);
        setFeatured(validResults[0] || null);
      } else {
        setMovies(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = validResults.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
      
      setTotalResults(data.total_results || 0);
      setHasMore(pageNum < (data.total_pages || 1));
      setPage(pageNum);
      
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load content');
      if (pageNum === 1) {
        setMovies([]);
        setFeatured(null);
      }
    } finally {
      if (shouldReset) {
        setLoading(false);
      }
    }
  }, [showTVSeriesPage, selectedLanguage]);

  const fetchByCategory = useCallback(async (cat, pageNum = 1, shouldReset = true) => {
    if (!API_KEY || API_KEY === 'undefined') return;
    
    try {
      if (shouldReset) {
        setLoading(true);
      }
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
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=${tvCat}&sort_by=popularity.desc&page=${pageNum}&language=${selectedLanguage}`;
        } else if (tvCat === 'tagalog_tv') {
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=tl&sort_by=popularity.desc&page=${pageNum}&language=${selectedLanguage}`;
        } else {
          endpoint = `https://api.themoviedb.org/3/tv/${tvCat}?api_key=${API_KEY}&page=${pageNum}&language=${selectedLanguage}`;
        }
      } else {
        if (cat === "filipino") {
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_original_language=tl&region=PH&sort_by=popularity.desc&page=${pageNum}&language=${selectedLanguage}`;
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
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}&language=${selectedLanguage}`;
        }
        else {
          endpoint = `https://api.themoviedb.org/3/movie/${cat}?api_key=${API_KEY}&page=${pageNum}&language=${selectedLanguage}`;
        }
      }

      const res = await fetch(endpoint);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("API rate limit exceeded. Please try again later.");
        }
        throw new Error(`Failed to fetch data: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid data received from API");
      }
      
      const validResults = data.results.filter(isValidMediaItem);
      
      if (pageNum === 1 || shouldReset) {
        setMovies(validResults);
        setFeatured(validResults[0] || null);
      } else {
        setMovies(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = validResults.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
      
      setTotalResults(data.total_results || 0);
      setHasMore(pageNum < (data.total_pages || 1));
      setPage(pageNum);
      
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || 'Failed to load content');
      if (pageNum === 1) {
        setMovies([]);
        setFeatured(null);
      }
    } finally {
      if (shouldReset) {
        setLoading(false);
      }
    }
  }, [showTVSeriesPage, selectedLanguage]);

  // ================= Load More Function =================
  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    
    if (category === "trending") {
      fetchTrending(page + 1, false);
    } else {
      fetchByCategory(category, page + 1, false);
    }
  }, [category, page, loading, hasMore, fetchTrending, fetchByCategory]);

  // ================= Intersection Observer =================
  useEffect(() => {
    if (loading || !hasMore || search.trim() || showTVDetails || movies.length === 0) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (lastMovieRef.current) {
      observerRef.current.observe(lastMovieRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [loading, hasMore, search, handleLoadMore, showTVDetails, movies.length]);

  // ================= Search Functions =================
  const fetchSearchSuggestions = useCallback(async (query) => {
    if (!API_KEY || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const currentType = showTVSeriesPage ? 'tv' : 'movie';
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=${selectedLanguage}&page=1`
      );
      
      if (!res.ok) return;
      
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        setSuggestions(data.results.slice(0, 5).filter(isValidMediaItem));
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      setSuggestions([]);
    }
  }, [showTVSeriesPage, selectedLanguage]);

  // ================= Handle Clear Search Function =================
  const handleClearSearch = useCallback(() => {
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setIsSearching(false);
    setPage(1);
    setHasMore(true);
    setMovies([]);
    setTotalResults(0);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    if (category === "trending") {
      fetchTrending();
    } else {
      fetchByCategory(category);
    }
    
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [category, fetchTrending, fetchByCategory]);

  // ================= Perform Search Function =================
  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      handleClearSearch();
      return;
    }

    try {
      setIsSearching(true);
      setLoading(true);
      setError(null);
      
      const currentType = showTVSeriesPage ? 'tv' : 'movie';
      const endpoint = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=${selectedLanguage}&page=1`;
      
      const res = await fetch(endpoint);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("API rate limit exceeded. Please try again later.");
        }
        throw new Error(`Search failed: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.results && Array.isArray(data.results)) {
        const validResults = data.results.filter(isValidMediaItem);
        setSearchResults(validResults);
        setTotalResults(data.total_results || 0);
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
      
      setSuggestions([]);
      setFeatured(null);
      setMovies([]);
      setPage(1);
      setHasMore(false);
      
    } catch (err) {
      setError(err.message || 'Search failed');
      setSearchResults([]);
      setSuggestions([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  }, [showTVSeriesPage, selectedLanguage, handleClearSearch]);

  // ================= Search Handler =================
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    if (!value.trim()) {
      handleClearSearch();
      return;
    }
    
    if (value.trim().length >= 2) {
      setIsSearching(true);
      
      typingTimeoutRef.current = setTimeout(() => {
        fetchSearchSuggestions(value);
      }, 300);
      
      debounceRef.current((query) => {
        performSearch(query);
      }, 500)(value);
    } else {
      setSuggestions([]);
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Escape':
        handleClearSearch();
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
        break;
      case 'Enter':
        if (search.trim()) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          performSearch(search);
        }
        break;
      default:
        break;
    }
  };

  // ================= Load Data =================
  useEffect(() => {
    if (!search.trim()) {
      setPage(1);
      setHasMore(true);
      setSearchResults([]);
      setSuggestions([]);
      if (category === "trending") {
        fetchTrending();
      } else {
        fetchByCategory(category);
      }
    }
  }, [category, showTVSeriesPage, selectedLanguage, search, fetchTrending, fetchByCategory]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const handleSuggestionClick = (item) => {
    if (!isValidMediaItem(item)) return;
    
    setSearch(item.title || item.name);
    performSearch(item.title || item.name);
  };

  // ================= Watch Function =================
  const startWatching = (item) => {
    if (!isValidMediaItem(item)) return;
    
    if (showTVSeriesPage) {
      setSelectedTVShow(item);
      setShowTVDetails(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    const url = `https://vidsrc.to/embed/movie/${item.id}`;
    setWatchUrl(url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEpisodeSelect = (episode) => {
    if (!selectedTVShow?.id || !isValidEpisode(episode)) return;
    
    const url = `https://vidsrc.to/embed/tv/${selectedTVShow.id}/${episode.season_number}/${episode.episode_number}`;
    setWatchUrl(url);
    setShowTVDetails(false);
    setSelectedTVShow(null);
    // Save the episode info so we know where to go back
    setLastSelectedEpisode({
      show: selectedTVShow,
      episode: episode
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ================= Back Button Function =================
  const handleBackFromWatch = () => {
    setWatchUrl(null);
    
    // If we have a last selected episode and we're in TV series mode,
    // go back to the TV show details modal
    if (showTVSeriesPage && lastSelectedEpisode?.show) {
      setSelectedTVShow(lastSelectedEpisode.show);
      setShowTVDetails(true);
    } else if (showTVSeriesPage && selectedTVShow) {
      // If we don't have last episode but have selected TV show,
      // go back to the TV show details
      setShowTVDetails(true);
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ================= Favorite Function =================
  const toggleFavorite = useCallback((item) => {
    if (!isValidMediaItem(item)) return;
    
    setFavorites(prev => {
      const exists = prev.some(fav => fav.id === item.id && fav.type === (showTVSeriesPage ? 'tv' : 'movie'));
      if (exists) {
        return prev.filter(fav => !(fav.id === item.id && fav.type === (showTVSeriesPage ? 'tv' : 'movie')));
      } else {
        return [...prev, { ...item, type: showTVSeriesPage ? 'tv' : 'movie' }];
      }
    });
  }, [showTVSeriesPage]);

  const isItemFavorite = useCallback((item) => {
    if (!isValidMediaItem(item)) return false;
    return favorites.some(fav => fav.id === item.id && fav.type === (showTVSeriesPage ? 'tv' : 'movie'));
  }, [favorites, showTVSeriesPage]);

  const displayMovies = search.trim() ? searchResults.filter(isValidMediaItem) : movies.filter(isValidMediaItem);
  const heroImage = featured && (featured.backdrop_path || featured.poster_path)
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

  // Calculate total pages safely
  const totalPages = Math.max(1, Math.ceil(totalResults / 20));

  return (
    <div className="bg-black text-white min-h-screen">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      
      {/* Skip to content link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-red-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg transition-colors duration-300"
      >
        Skip to main content
      </a>
      
      {/* Loading status for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loading && "Loading content..."}
        {isSearching && "Searching..."}
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-black/95 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-900 backdrop-blur-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1
            onClick={() => {
              handleClearSearch();
              setWatchUrl(null);
              setShowTVDetails(false);
              setSelectedTVShow(null);
              setLastSelectedEpisode(null);
              setCategory("trending");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-2xl md:text-3xl font-bold cursor-pointer hover:text-red-500 whitespace-nowrap transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg px-2"
            role="button"
            tabIndex={0}
            aria-label="MovieHouse - Go to homepage"
          >
            🎬 Movie<span className="text-red-600">House</span>
          </h1>
          
          <div className="relative flex-1 md:flex-none md:w-64 lg:w-80 flex items-center">
            <div className="relative w-full">
              <input
                ref={searchInputRef}
                className="bg-gray-900/80 px-4 py-2 rounded-full w-full placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 pr-10 border border-gray-700"
                placeholder={showTVSeriesPage ? "Search TV shows..." : "Search movies..."}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                type="search"
                aria-label="Search"
                aria-describedby="search-description"
              />
              
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {search ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-1"
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg overflow-hidden z-50 border border-gray-700 shadow-xl">
                  {suggestions.map((item) => (
                    <button
                      key={`suggestion-${item.id}`}
                      className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-start gap-3 transition-colors duration-200 focus:outline-none focus:bg-gray-800"
                      onClick={() => handleSuggestionClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(item)}
                      aria-label={`Select ${item.title || item.name}`}
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
                          {typeof item.vote_average === 'number' && ` • ⭐ ${item.vote_average.toFixed(1)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              setShowTVSeriesPage(false);
              setCategory("trending");
              handleClearSearch();
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${
              !showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-label="Switch to movies"
            aria-current={!showTVSeriesPage ? "true" : "false"}
          >
            🎬 Movies
          </button>
          <button
            onClick={() => {
              setShowTVSeriesPage(true);
              setCategory("popular_tv");
              handleClearSearch();
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${
              showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-label="Switch to TV series"
            aria-current={showTVSeriesPage ? "true" : "false"}
          >
            📺 TV Series
          </button>
          
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 border border-gray-700 appearance-none pl-8 pr-4"
              aria-label="Select language"
            >
              <option value="en">🇺🇸 English</option>
              <option value="tl">🇵🇭 Tagalog</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="fr">🇫🇷 French</option>
              <option value="de">🇩🇪 German</option>
            </select>
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              🌐
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 md:pt-28" id="main-content">
        {!watchUrl && !search.trim() && !showTVDetails && (
          <div className="px-4 md:px-6 mb-6 md:mb-8">
            <CategoryButtons
              categories={currentCategoryLabels}
              currentCategory={category}
              onSelect={(cat) => {
                setCategory(cat);
                handleClearSearch();
              }}
              showTVSeriesPage={showTVSeriesPage}
            />
          </div>
        )}

        {watchUrl ? (
          <div className="px-4 md:px-6">
            <button
              onClick={handleBackFromWatch}
              className="mb-4 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors duration-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Go back"
            >
              ← Back {showTVSeriesPage ? "to Episodes" : "to List"}
            </button>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-800">
              <iframe
                src={watchUrl}
                title="Video player"
                allowFullScreen
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        ) : (
          <>
            {featured && !search.trim() && !showTVDetails && (
              <div 
                className="relative h-[50vh] md:h-[70vh] bg-cover bg-center mb-8 md:mb-12"
                style={{ 
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${heroImage})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover'
                }}
                role="banner"
                aria-label="Featured content"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
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
                        className="bg-red-600 hover:bg-red-700 px-5 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors duration-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
                        aria-label={`${showTVSeriesPage ? "Browse episodes for" : "Play"} ${featured.title || featured.name}`}
                      >
                        <span>▶</span> {showTVSeriesPage ? "Browse Episodes" : "Play Now"}
                      </button>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <span className="bg-gray-900/80 px-3 py-1 rounded-full">
                          ⭐ {typeof featured.vote_average === 'number' ? featured.vote_average.toFixed(1) : 'N/A'}
                        </span>
                        <span>
                          {featured.release_date?.substring(0,4) || featured.first_air_date?.substring(0,4) || 'N/A'}
                        </span>
                        {!showTVSeriesPage && (
                          <span className="text-gray-400">• {formatRuntime(featured.runtime)}</span>
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
                  {currentCategoryLabels[category]}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {[...Array(12)].map((_, i) => (
                    <MovieSkeleton key={`skeleton-${i}`} />
                  ))}
                </div>
              </div>
            ) : !loading && !error && displayMovies.length > 0 && !showTVDetails && (
              <div className="px-4 md:px-6">
                {!search.trim() && (
                  <h2 className="text-xl md:text-2xl font-bold mb-6">
                    {currentCategoryLabels[category]}
                    <span className="text-gray-400 text-base ml-2">
                      ({totalResults.toLocaleString()} {showTVSeriesPage ? 'TV shows' : 'movies'})
                    </span>
                  </h2>
                )}
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {displayMovies.map((item, index) => (
                    <div 
                      ref={index === displayMovies.length - 1 ? lastMovieRef : null}
                      key={`${item.id}-${item.title || item.name}-${index}`}
                    >
                      <MovieItem
                        item={item}
                        type={showTVSeriesPage ? "tv" : "movie"}
                        onClick={startWatching}
                        onFavoriteToggle={toggleFavorite}
                        isFavorite={isItemFavorite(item)}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Load More Section */}
                {!search.trim() && hasMore && displayMovies.length > 0 && (
                  <div className="text-center mt-8 mb-12">
                    <p className="text-gray-400 mb-2">
                      Showing {displayMovies.length} of {totalResults.toLocaleString()} results • Page {page} of {totalPages}
                    </p>
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Load more content"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Loading...
                        </span>
                      ) : "Load More"}
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
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Clear search"
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
              onClick={() => category === "trending" ? fetchTrending() : fetchByCategory(category)}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* TV Show Details Modal */}
      <TVShowDetailsModal
        show={selectedTVShow}
        isOpen={showTVDetails}
        onClose={() => {
          setShowTVDetails(false);
          setSelectedTVShow(null);
          setLastSelectedEpisode(null);
        }}
        onEpisodeSelect={handleEpisodeSelect}
      />

      {/* SIMPLE DISCLAIMER */}
      <footer className="mt-12 border-t border-gray-900 py-8">
        <div className="px-4 md:px-6 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-600/20 rounded-full mb-3">
              <span className="text-2xl" aria-hidden="true">⚠️</span>
            </div>
            <h3 className="text-xl font-bold mb-2">LEGAL DISCLAIMER</h3>
          </div>
          
          <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800">
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
              <p className="text-gray-500 text-xs text-center mt-2">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
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
