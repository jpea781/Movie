// ================= IMAGE OPTIMIZATION UTILITIES =================

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/300x450/111/666?text=No+Poster";

// Image size presets for different use cases
export const imageSizes = {
  thumbnail: "w92",      // Search suggestions (92px wide)
  small: "w154",         // Small cards (154px)
  card: "w342",          // Movie/TV cards (342px) - OPTIMAL for grid
  medium: "w500",        // Modals, details (500px)
  large: "w780",         // Backdrops, hero images (780px)
  xlarge: "w1280",       // HD backdrops (1280px)
  original: "original"   // Only when absolutely needed
};

// Get optimized image URL with WebP support
export const getOptimizedImageUrl = (path, options = {}) => {
  if (!path) return PLACEHOLDER_IMAGE;
  
  const {
    size = imageSizes.card,   // Default: card size
    format = "webp",          // Modern format
    quality = 80,             // Quality percentage
    retina = false            // For high-DPI screens
  } = options;
  
  // Choose size - double for retina displays
  const actualSize = retina && size !== "original" 
    ? size.replace('w', '') * 2 
    : size;
  
  const sizePrefix = size === "original" ? "original" : `w${actualSize}`;
  const baseUrl = `${TMDB_IMAGE_BASE}${sizePrefix}${path}`;
  
  // Add WebP format for modern browsers (30-50% smaller)
  if (format === "webp" && size !== "original") {
    return `${baseUrl}?format=webp&quality=${quality}`;
  }
  
  return baseUrl;
};

// Generate srcSet for responsive images
export const getImageSrcSet = (path, format = "webp") => {
  if (!path) return "";
  
  const sizes = [
    { width: "92w", size: imageSizes.thumbnail },
    { width: "154w", size: imageSizes.small },
    { width: "342w", size: imageSizes.card },
    { width: "500w", size: imageSizes.medium },
    { width: "780w", size: imageSizes.large },
    { width: "1280w", size: imageSizes.xlarge }
  ];
  
  return sizes
    .map(({ width, size }) => {
      const url = getOptimizedImageUrl(path, { size, format });
      return `${url} ${width}`;
    })
    .join(', ');
};

// Get appropriate image size based on container width
export const getResponsiveSize = (containerWidth) => {
  if (containerWidth <= 200) return imageSizes.thumbnail;
  if (containerWidth <= 300) return imageSizes.small;
  if (containerWidth <= 400) return imageSizes.card;
  if (containerWidth <= 600) return imageSizes.medium;
  if (containerWidth <= 900) return imageSizes.large;
  return imageSizes.xlarge;
};

// Get backdrop image for hero section
export const getBackdropImage = (path, isHighDPI = false) => {
  return getOptimizedImageUrl(path, {
    size: isHighDPI ? imageSizes.xlarge : imageSizes.large,
    format: "webp",
    quality: 85
  });
};

// Simple placeholder for testing
export const getSimpleImageUrl = (path, size = "w342") => {
  if (!path) return PLACEHOLDER_IMAGE;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
};