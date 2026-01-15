import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const IMG = "https://image.tmdb.org/t/p/original";

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
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleClick = () => {
    onClick(item);
  };

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

  // TV Show specific info
  const renderTVShowInfo = () => {
    if (type !== "tv") return null;
    
    return (
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {item.first_air_date && (
            <span>📅 {item.first_air_date.substring(0, 4)}</span>
          )}
          {item.number_of_seasons && (
            <span>• {item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>
          )}
          {item.number_of_episodes && (
            <span>• {item.number_of_episodes} Episodes</span>
          )}
          {item.episode_run_time?.[0] && (
            <span>• {item.episode_run_time[0]}m</span>
          )}
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
            {item.runtime && (
              <span className="ml-2">• {formatRuntime(item.runtime)}</span>
            )}
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

// ================= TV Show Details Component =================
const TVShowDetails = ({ show, onClose, onPlayEpisode }) => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  // Memoize fetchEpisodes to fix dependency warning
  const fetchEpisodes = useCallback(async (seasonNumber) => {
    setLoadingEpisodes(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${show.id}/season/${seasonNumber}?api_key=${API_KEY}`
      );
      const data = await response.json();
      setEpisodes(data.episodes || []);
      setSelectedSeason(seasonNumber);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
  }, [show]);

  // Fetch seasons on component mount
  useEffect(() => {
    if (!show?.id) return;

    const fetchSeasons = async () => {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/tv/${show.id}?api_key=${API_KEY}&append_to_response=credits,content_ratings`
        );
        const data = await response.json();
        setSeasons(data.seasons || []);
        
        if (data.seasons?.[0]) {
          // Fetch episodes for first season
          fetchEpisodes(data.seasons[0].season_number);
        }
      } catch (error) {
        console.error('Error fetching seasons:', error);
      }
    };

    fetchSeasons();
  }, [show, fetchEpisodes]); // Added fetchEpisodes to dependencies

  // Keyboard navigation with proper dependencies
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!seasons.length) return;
        
        const currentIndex = seasons.findIndex(s => s.season_number === selectedSeason);
        let nextIndex;
        
        if (e.key === 'ArrowRight') {
          nextIndex = currentIndex < seasons.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : seasons.length - 1;
        }
        
        if (seasons[nextIndex]) {
          fetchEpisodes(seasons[nextIndex].season_number);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seasons, selectedSeason, onClose, fetchEpisodes]);

  const formatRuntime = (minutes) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const playFirstEpisode = () => {
    if (episodes.length > 0) {
      onPlayEpisode(show, selectedSeason, 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ 
          backgroundImage: `url(https://image.tmdb.org/t/p/original${show.backdrop_path})` 
        }}
      />
      
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/80 transition-colors"
        aria-label="Close"
      >
        ✕
      </button>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Show Header */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          <div className="lg:w-1/4">
            <img
              src={
                show.poster_path
                  ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
                  : "https://via.placeholder.com/300x450/111/666?text=No+Poster"
              }
              alt={show.name}
              className="rounded-xl shadow-2xl w-full"
            />
          </div>
          
          <div className="lg:w-3/4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{show.name}</h1>
                <div className="flex items-center gap-3 text-gray-300 mb-4">
                  <span className="bg-gray-800 px-3 py-1 rounded-full">
                    ⭐ {show.vote_average?.toFixed(1)} ({show.vote_count} votes)
                  </span>
                  <span>{show.first_air_date?.substring(0, 4)}</span>
                  <span>• {show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>
                  <span>• {show.number_of_episodes} Episodes</span>
                  {show.episode_run_time?.[0] && (
                    <span>• {formatRuntime(show.episode_run_time[0])}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Genres */}
            {show.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {show.genres.map(genre => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-gray-800 rounded-full text-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}
            
            {/* Overview */}
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2">Overview</h3>
              <p className="text-gray-300 leading-relaxed">{show.overview}</p>
            </div>
            
            {/* Show Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <h4 className="text-gray-400 text-sm">Status</h4>
                <p className="font-semibold">{show.status}</p>
              </div>
              <div>
                <h4 className="text-gray-400 text-sm">Type</h4>
                <p className="font-semibold">{show.type}</p>
              </div>
              <div>
                <h4 className="text-gray-400 text-sm">Language</h4>
                <p className="font-semibold">
                  {show.original_language === 'en' ? 'English' : 
                   show.original_language === 'tl' ? 'Tagalog' : 
                   show.original_language?.toUpperCase()}
                </p>
              </div>
              <div>
                <h4 className="text-gray-400 text-sm">Last Air Date</h4>
                <p className="font-semibold">{show.last_air_date || 'N/A'}</p>
              </div>
            </div>
            
            {/* Networks */}
            {show.networks?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-gray-400 text-sm mb-2">Networks</h4>
                <div className="flex gap-3">
                  {show.networks.map(network => (
                    <div key={network.id} className="flex items-center gap-2 bg-gray-900/50 px-3 py-2 rounded-lg">
                      {network.logo_path && (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${network.logo_path}`}
                          alt={network.name}
                          className="h-6"
                        />
                      )}
                      <span className="text-sm">{network.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={playFirstEpisode}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-300 flex items-center gap-2"
              >
                <span>▶</span> Play First Episode
              </button>
              
              <button
                onClick={() => setShowCredits(!showCredits)}
                className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
              >
                {showCredits ? 'Hide Cast' : 'Show Cast'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Cast (Collapsible) */}
        {showCredits && show.credits?.cast?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Cast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {show.credits.cast.slice(0, 10).map(person => (
                <div key={person.id} className="bg-gray-900/50 rounded-lg p-3">
                  {person.profile_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                      alt={person.name}
                      className="w-full h-48 object-cover rounded-lg mb-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center mb-3">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                  <h4 className="font-semibold truncate">{person.name}</h4>
                  <p className="text-gray-400 text-sm truncate">{person.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Seasons Selector */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Seasons</h2>
          <div className="flex flex-wrap gap-2">
            {seasons
              .filter(season => season.season_number > 0)
              .map(season => (
                <button
                  key={season.id}
                  onClick={() => fetchEpisodes(season.season_number)}
                  className={`px-4 py-2 rounded-lg transition-colors duration-300 ${
                    selectedSeason === season.season_number
                      ? 'bg-red-600'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  Season {season.season_number}
                  {season.air_date && (
                    <span className="text-gray-300 text-sm ml-2">
                      ({season.air_date.substring(0, 4)})
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
        
        {/* Episodes List */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              Season {selectedSeason} Episodes
              <span className="text-gray-400 text-lg ml-2">
                ({episodes.length} episodes)
              </span>
            </h2>
            <button
              onClick={playFirstEpisode}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors duration-300 flex items-center gap-2"
            >
              <span>▶</span> Play All
            </button>
          </div>
          
          {loadingEpisodes ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-400">Loading episodes...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {episodes.map(episode => (
                <div
                  key={episode.id}
                  className="bg-gray-900/50 rounded-lg p-4 hover:bg-gray-800/50 transition-colors duration-300 cursor-pointer border-l-3 border-transparent hover:border-red-600"
                  onClick={() => onPlayEpisode(show, selectedSeason, episode.episode_number)}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center relative">
                      <span className="font-bold">E{episode.episode_number}</span>
                      <span className="absolute text-gray-400 text-xs -top-2 left-2">E</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{episode.name}</h3>
                          <div className="flex items-center gap-3 text-gray-400 text-sm mb-2">
                            <span>⭐ {episode.vote_average?.toFixed(1) || 'N/A'}</span>
                            {episode.runtime && (
                              <span>• {formatRuntime(episode.runtime)}</span>
                            )}
                            {episode.air_date && (
                              <span>• {episode.air_date}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayEpisode(show, selectedSeason, episode.episode_number);
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-300 flex items-center gap-2"
                        >
                          <span>▶</span> Play
                        </button>
                      </div>
                      
                      {episode.overview && (
                        <p className="text-gray-300 text-sm line-clamp-2 mb-2">{episode.overview}</p>
                      )}
                      
                      {episode.guest_stars?.slice(0, 3).length > 0 && (
                        <div className="mt-2">
                          <span className="text-gray-400 text-xs">With: </span>
                          <span className="text-gray-300 text-xs">
                            {episode.guest_stars.slice(0, 3).map(star => star.name).join(', ')}
                            {episode.guest_stars.length > 3 && '...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Additional Info */}
        <div className="bg-gray-900/30 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold mb-4">Series Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-gray-400 text-sm mb-1">Created By</h4>
              <p className="font-medium">
                {show.created_by?.map(creator => creator.name).join(', ') || 'N/A'}
              </p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm mb-1">Original Network</h4>
              <p className="font-medium">
                {show.networks?.[0]?.name || 'N/A'}
              </p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm mb-1">First Aired</h4>
              <p className="font-medium">{show.first_air_date || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm mb-1">Last Aired</h4>
              <p className="font-medium">{show.last_air_date || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  
  // TV Show states
  const [selectedTVShow, setSelectedTVShow] = useState(null);
  const [showTVDetails, setShowTVDetails] = useState(false);
  const [showTVSeriesPage, setShowTVSeriesPage] = useState(false);
  
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
    
    if (now - lastAdTimeRef.current < adCooldown) {
      console.log('⏳ Ad cooldown active, skipping');
      return;
    }
    
    if (adsLoaded) {
      console.log('✅ Ads already loaded');
      return;
    }

    console.log('🚀 ATTEMPTING TO LOAD POPADS...');
    
    const injectPopAdsScript = () => {
      return new Promise((resolve) => {
        try {
          document.querySelectorAll('script').forEach(script => {
            if (script.textContent && script.textContent.includes('a8876ec4588517dc1fe664b0e6812854')) {
              script.remove();
            }
          });

          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.setAttribute('data-cfasync', 'false');
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
          
          document.body.appendChild(script);
          
        } catch (error) {
          console.log('Error in injectPopAdsScript:', error);
          resolve(false);
        }
      });
    };

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
                    /*<![CDATA[/* */(function(){var x=window,v="a8876ec4588517dc1fe664b0e6812854",d=[["siteId",847*577+608*61*11+4371892],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],u=["d3d3LmRpc3BsYXl2ZXJ0aXNpbmcuY29tL3lpbnN0YWZldGNoLm1pbi5jc3M=","ZDNtem9rdHk5NTFjNXcuY2xvdWRmcm9udC5uZXQvY2pYYnQvZ2pzb25saW50Lm1pbi5qcw=="],e=-1,m,c,n=function(){clearTimeout(c);e++;if(u[e]&&!(1794245271000<(new Date).getTime()&&1<e)){m=x.document.createElement("script");m.type="text/javascript";m.async=!0;var i=x.document.getElementsByTagName("script")[0];m.src="https://"+atob(u[e]);m.crossOrigin="anonymous";m.onerror=n;m.onload=function(){clearTimeout(c);x[v.slice(0,16)+v.slice(0,16)]||n()};c=setTimeout(n,5E3);i.parentNode.insertBefore(m,i)}};if(!x[v]){try{Object.freeze(x[v]=d)}catch(e){}n()}})();/*]]>/* */
                    parent.postMessage('popads-loaded', '*');
                  } catch(e) {
                    parent.postMessage('popads-error', '*');
                  }
                </script>
              </head>
              <body></body>
            </html>
          `;
          
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

    const tryAllMethods = async () => {
      console.log('Trying Method 1: Direct injection...');
      const method1Success = await injectPopAdsScript();
      
      if (!method1Success) {
        console.log('Method 1 failed, trying Method 2: Iframe...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const method2Success = await injectViaIframe();
        
        if (!method2Success) {
          console.log('❌ All ad loading methods failed');
        }
      }
    };

    tryAllMethods();
  }, [adsLoaded]);

  // ================= Load initial ads after delay =================
  useEffect(() => {
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

  // ================= UPDATED: Categories for Movies and TV Series =================
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

  // Current category labels based on page
  const currentCategoryLabels = showTVSeriesPage ? tvCategoryLabels : movieCategoryLabels;

  // ================= UPDATED: API Functions with Load More =================
  const fetchTrending = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/${showTVSeriesPage ? 'tv' : 'movie'}/week?api_key=${API_KEY}&page=${pageNum}&append_to_response=credits`
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
  }, [showTVSeriesPage, errorMessages]);

  const fetchByCategory = useCallback(async (cat, pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = "";
      
      if (showTVSeriesPage) {
        // TV SERIES PAGE CATEGORIES
        const tvCatMap = {
          'popular_tv': 'popular',
          'top_rated_tv': 'top_rated',
          'on_the_air': 'on_the_air',
          'airing_today': 'airing_today',
          'tv_action': 10759, // Action & Adventure
          'tv_comedy': 35,
          'tv_drama': 18,
          'tv_scifi': 10765, // Sci-Fi & Fantasy
          'tv_animation': 16,
          'tagalog_tv': 'tagalog_tv',
          'tv_mystery': 9648,
          'tv_reality': 10764,
          'tv_documentary': 99
        };
        
        const tvCat = tvCatMap[cat];
        
        if (typeof tvCat === 'number') {
          // Genre-based TV shows
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=${tvCat}&sort_by=popularity.desc&page=${pageNum}&include_adult=false&append_to_response=credits`;
        } else if (tvCat === 'tagalog_tv') {
          // Tagalog TV shows
          endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=tl&sort_by=popularity.desc&page=${pageNum}&include_adult=false&append_to_response=credits`;
        } else {
          // Standard TV categories
          endpoint = `https://api.themoviedb.org/3/tv/${tvCat}?api_key=${API_KEY}&page=${pageNum}&append_to_response=credits`;
        }
      } else {
        // MOVIE PAGE CATEGORIES
        if (cat === "filipino") {
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_original_language=tl&region=PH&sort_by=popularity.desc&page=${pageNum}&include_adult=false&append_to_response=credits`;
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
          endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}&include_adult=false&append_to_response=credits`;
        }
        else {
          endpoint = `https://api.themoviedb.org/3/movie/${cat}?api_key=${API_KEY}&page=${pageNum}&append_to_response=credits`;
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
      setError(errorMessages[err.message] || errorMessages.default);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [showTVSeriesPage, errorMessages]);

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
      const currentType = showTVSeriesPage ? 'tv' : 'movie';
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1&append_to_response=credits`
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
      const endpoint = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1&append_to_response=credits`;
      
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
  }, [showTVSeriesPage, category, fetchTrending, fetchByCategory, errorMessages]);

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
      
      typingTimeoutRef.current = setTimeout(() => {
        fetchSearchSuggestions(value);
      }, 300);
      
      typingTimeoutRef.current = setTimeout(() => {
        performSearch(value);
        
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
  }, [category, showTVSeriesPage, search, fetchTrending, fetchByCategory]);

  // ================= Local Storage for Preferences =================
  useEffect(() => {
    const preferences = {
      showTVSeriesPage,
      category,
      lastSearch: search
    };
    localStorage.setItem('moviehouse_prefs', JSON.stringify(preferences));
  }, [showTVSeriesPage, category, search]);

  useEffect(() => {
    const saved = localStorage.getItem('moviehouse_prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        setShowTVSeriesPage(prefs.showTVSeriesPage || false);
        setCategory(prefs.category || 'trending');
        if (prefs.lastSearch && prefs.lastSearch.trim()) {
          setSearch(prefs.lastSearch);
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

  // ================= Enhanced Watch Function =================
  const startWatching = (item) => {
    if (!item?.id) return;
    
    // If on TV Series page, show details modal
    if (showTVSeriesPage) {
      setSelectedTVShow(item);
      setShowTVDetails(true);
      return;
    }
    
    // For movies, load ads and play
    loadPopAds();
    
    setTimeout(() => {
      const url = `https://vidsrc.to/embed/movie/${item.id}`;
      setWatchUrl(url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);
  };

  // ================= Play TV Episode =================
  const playEpisode = (show, seasonNumber, episodeNumber) => {
    loadPopAds();
    
    setTimeout(() => {
      const url = `https://vidsrc.to/embed/tv/${show.id}/${seasonNumber}/${episodeNumber}`;
      setWatchUrl(url);
      setShowTVDetails(false);
      setSelectedTVShow(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);
  };

  // ================= Close TV Details =================
  const closeTVDetails = () => {
    setShowTVDetails(false);
    setSelectedTVShow(null);
  };

  // ================= UPDATED: Reset to Home with Scroll to Top =================
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
    setShowTVDetails(false);
    setSelectedTVShow(null);
    setShowTVSeriesPage(false);
    
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    fetchTrending();
  };

  // ================= Switch to TV Series Page =================
  const goToTVSeries = () => {
    setShowTVSeriesPage(true);
    setCategory("popular_tv");
    setPage(1);
    setHasMore(true);
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setWatchUrl(null);
    setShowTVDetails(false);
    setSelectedTVShow(null);
    
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    setTimeout(() => {
      loadPopAds();
    }, 1000);
  };

  // ================= Switch to Movies Page =================
  const goToMovies = () => {
    setShowTVSeriesPage(false);
    setCategory("trending");
    setPage(1);
    setHasMore(true);
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    setWatchUrl(null);
    setShowTVDetails(false);
    setSelectedTVShow(null);
    
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    setTimeout(() => {
      loadPopAds();
    }, 1000);
  };

  // ================= NEW: Handle category change =================
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
    setHasMore(true);
    setSearch("");
    setSearchResults([]);
    setSuggestions([]);
    
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
        : showTVSeriesPage
          ? category === "tagalog_tv"
            ? `Tagalog TV Shows - MovieHouse`
            : `${currentCategoryLabels[category]} - MovieHouse`
          : category === "filipino"
            ? `Tagalog Movies - MovieHouse`
            : `${currentCategoryLabels[category]} - MovieHouse`;
    
    document.title = title;
  }, [search, watchUrl, category, showTVSeriesPage, currentCategoryLabels]);

  // ================= Cleanup on unmount =================
  useEffect(() => {
    return () => {
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
                placeholder={showTVSeriesPage ? "Search TV shows..." : "Search movies..."}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                type="text"
                aria-label={showTVSeriesPage ? "Search TV shows" : "Search movies"}
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
              
              {suggestions.length > 0 && search.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg overflow-hidden z-50 border border-gray-700">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-start gap-3 transition-colors duration-200"
                      onClick={() => handleSuggestionClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(item)}
                    >
                      <img
                        src={item.poster_path ? `${IMG}w92${item.poster_path}` : "https://via.placeholder.com/46x69/111/666"}
                        alt=""
                        className="w-10 h-15 object-cover rounded"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title || item.name}</p>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                          {item.overview || 'No description available'}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || "Unknown"}
                          {item.vote_average && ` • ⭐ ${item.vote_average.toFixed(1)}`}
                          {item.credits?.cast?.[0] && ` • ${item.credits.cast[0].name}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p id="search-description" className="sr-only">
              {showTVSeriesPage ? "Search for TV shows by title. Start typing to see suggestions." : "Search for movies by title. Start typing to see suggestions."}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={goToMovies}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              !showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-pressed={!showTVSeriesPage}
          >
            🎬 Movies
          </button>
          <button
            onClick={goToTVSeries}
            className={`px-4 py-2 rounded-full text-sm transition-colors duration-300 ${
              showTVSeriesPage ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-pressed={showTVSeriesPage}
          >
            📺 TV Series
          </button>
        </div>
      </nav>

      <div className="pt-24 md:pt-28">
        {/* TV Show Details Modal */}
        {showTVDetails && selectedTVShow && (
          <TVShowDetails
            show={selectedTVShow}
            onClose={closeTVDetails}
            onPlayEpisode={playEpisode}
          />
        )}

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

        {!watchUrl && !search.trim() && !showTVDetails && (
          <div className="px-4 md:px-6 mb-6 md:mb-8">
            <div className="flex flex-wrap gap-2 md:gap-3">
              {Object.keys(currentCategoryLabels).map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
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
                  aria-pressed={category === cat}
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
              aria-label="Back"
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
            
            {showTVSeriesPage && selectedTVShow && (
              <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
                <h3 className="text-xl font-bold mb-2">Now Playing</h3>
                <p className="text-gray-300">
                  {selectedTVShow.name} • Season {watchUrl.split('/').slice(-2)[0]} • Episode {watchUrl.split('/').slice(-1)[0]}
                </p>
                <button
                  onClick={() => {
                    setWatchUrl(null);
                    setShowTVDetails(true);
                  }}
                  className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-300"
                >
                  View All Episodes
                </button>
              </div>
            )}
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
                    
                    {/* Enhanced info for TV shows */}
                    {showTVSeriesPage && (
                      <div className="flex items-center gap-3 mb-3">
                        {featured.number_of_seasons && (
                          <span className="bg-gray-900/80 px-3 py-1 rounded-full text-sm">
                            {featured.number_of_seasons} Season{featured.number_of_seasons > 1 ? 's' : ''}
                          </span>
                        )}
                        {featured.number_of_episodes && (
                          <span className="text-gray-300 text-sm">
                            {featured.number_of_episodes} Episodes
                          </span>
                        )}
                        {featured.status && (
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            featured.status === 'Returning Series' ? 'bg-green-900/50 text-green-300' :
                            featured.status === 'Ended' ? 'bg-red-900/50 text-red-300' :
                            'bg-gray-800 text-gray-300'
                          }`}>
                            {featured.status}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="text-gray-300 mb-4 md:mb-6">
                      <p className="text-sm md:text-base line-clamp-3">
                        {featured.overview || "No description available."}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => startWatching(featured)}
                        className="bg-red-600 hover:bg-red-700 px-5 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors duration-300 flex items-center gap-2"
                        aria-label={`Play ${featured.title || featured.name}`}
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
                        {showTVSeriesPage && featured.episode_run_time?.[0] && (
                          <span className="text-gray-400">• {featured.episode_run_time[0]}m/ep</span>
                        )}
                        {(featured.original_language === 'tl' || 
                          (featured.origin_country && featured.origin_country.includes('PH'))) && 
                          <span className="ml-2 text-green-500">Tagalog</span>}
                      </div>
                    </div>
                    
                    {/* Cast info for featured */}
                    {featured.credits?.cast?.slice(0, 3).length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-400 mb-1">Starring:</p>
                        <div className="flex flex-wrap gap-2">
                          {featured.credits.cast.slice(0, 3).map(person => (
                            <span key={person.id} className="text-xs bg-gray-800 px-2 py-1 rounded">
                              {person.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading && !search.trim() && page === 1 ? (
              <div className="px-4 md:px-6">
                <h2 className="text-xl md:text-2xl font-bold mb-6">
                  {showTVSeriesPage ? (
                    category === "tagalog_tv" ? (
                      "Loading Tagalog TV Shows..."
                    ) : (
                      `Loading ${currentCategoryLabels[category]}...`
                    )
                  ) : (
                    category === "filipino" ? (
                      "Loading Tagalog Movies..."
                    ) : (
                      `Loading ${currentCategoryLabels[category]}...`
                    )
                  )}
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
                    {showTVSeriesPage ? (
                      category === "tagalog_tv" ? (
                        "Tagalog TV Shows"
                      ) : (
                        currentCategoryLabels[category]
                      )
                    ) : (
                      category === "filipino" ? (
                        "Tagalog Movies"
                      ) : (
                        currentCategoryLabels[category]
                      )
                    )}
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
                
                {/* Tagalog content note */}
                {(category === "filipino" || category === "tagalog_tv") && displayMovies.length > 0 && (
                  <div className="mt-8 p-4 bg-green-900/30 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-400 text-xl">🇵🇭</span>
                      <h3 className="text-lg font-bold">About Tagalog Content</h3>
                    </div>
                    <p className="text-gray-300 text-sm">
                      {category === "filipino" 
                        ? "These are movies originally in Tagalog (Filipino language) or produced in the Philippines. Enjoy authentic Filipino cinema with local stories and culture."
                        : "These are TV shows originally in Tagalog (Filipino language) or produced in the Philippines. Watch Filipino series, dramas, and entertainment shows."}
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
