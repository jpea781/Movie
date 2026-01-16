import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, getImageSrcSet } from '../utils/imageUtils';

const OptimizedImage = React.memo(({ 
  src, 
  alt, 
  size = "card",
  className = "",
  lazy = true,
  priority = false,
  onLoad,
  onError,
  containerRef,
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy || priority);
  const imgRef = useRef();
  const observerRef = useRef();
  
  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (!lazy || priority || isVisible) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0.1
      }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    observerRef.current = observer;
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [lazy, priority, isVisible]);
  
  // Don't render image if not visible yet
  if (!isVisible) {
    return (
      <div 
        ref={imgRef}
        className={`${className} bg-gray-800 animate-pulse rounded`}
        style={{ aspectRatio: '2/3' }}
        aria-hidden="true"
      />
    );
  }
  
  // Get optimized image URLs
  const optimizedSrc = getOptimizedImageUrl(src, { 
    size,
    format: "webp"
  });
  
  const fallbackSrc = getOptimizedImageUrl(src, { 
    size,
    format: "jpg"
  });
  
  const srcSet = getImageSrcSet(src, "webp");
  const fallbackSrcSet = getImageSrcSet(src, "jpg");
  
  const handleImageLoad = (e) => {
    setIsLoading(false);
    onLoad?.(e);
  };
  
  const handleImageError = (e) => {
    setImgError(true);
    setIsLoading(false);
    onError?.(e);
  };
  
  return (
    <div className="relative" ref={containerRef || imgRef}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse rounded" />
      )}
      
      {/* Picture element with WebP fallback */}
      <picture>
        {/* WebP source for modern browsers */}
        <source
          srcSet={srcSet}
          type="image/webp"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        
        {/* Fallback JPG for older browsers */}
        <source
          srcSet={fallbackSrcSet}
          type="image/jpeg"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        
        {/* Final fallback img element */}
        <img
          src={fallbackSrc}
          alt={alt}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          {...props}
        />
      </picture>
      
      {/* Error state */}
      {imgError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded">
          <div className="text-center p-4">
            <div className="text-gray-500 text-2xl mb-2" aria-hidden="true">🖼️</div>
            <p className="text-gray-400 text-sm">Image failed to load</p>
          </div>
        </div>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;