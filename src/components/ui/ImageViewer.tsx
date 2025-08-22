import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createImageSkeleton } from './skeleton';
import { EyeIcon } from '../icons/EyeIcon';

export interface ImageViewerProps {
  photoRef: string;
  placeName: string;
  width?: string;
  height?: string;
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  photoRef,
  placeName,
  width = '80px',
  height = '80px',
  className = ''
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const skeletonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create and manage skeleton loading state
  useEffect(() => {
    if (!imageLoaded && !imageError && containerRef.current) {
      // Show skeleton after 50ms if image hasn't loaded (not cached)
      skeletonTimeoutRef.current = setTimeout(() => {
        if (containerRef.current && !imageLoaded && !imageError) {
          const skeleton = createImageSkeleton(width, height);
          containerRef.current.appendChild(skeleton);
        }
        skeletonTimeoutRef.current = null;
      }, 50);
    }

    return () => {
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
        skeletonTimeoutRef.current = null;
      }
    };
  }, [imageLoaded, imageError, width, height]);

  const handleImageLoad = () => {
    // Cancel skeleton timeout if image loads quickly (cached)
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
      skeletonTimeoutRef.current = null;
    }
    
    // Remove any existing skeleton
    if (containerRef.current) {
      const skeleton = containerRef.current.querySelector('.skeleton');
      if (skeleton) {
        skeleton.remove();
      }
    }
    
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    // Cancel skeleton timeout
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
      skeletonTimeoutRef.current = null;
    }
    
    // Remove any existing skeleton
    if (containerRef.current) {
      const skeleton = containerRef.current.querySelector('.skeleton');
      if (skeleton) {
        skeleton.remove();
      }
    }
    
    setImageError(true);
    setImageLoaded(false);
  };

  const handleMouseEnter = () => {
    if (imageLoaded && !imageError) {
      setIsHovered(true);
      setShowPopover(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPopover(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative bg-gray-100 rounded-md overflow-hidden ${className}`}
        style={{ width, height }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Main image */}
        <img
          ref={imageRef}
          src={`/api/places/photos/${photoRef}?width=400`}
          alt={placeName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.2s ease, opacity 0.3s ease',
            opacity: imageLoaded ? 1 : 0,
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />

        {/* Semi-transparent overlay with eye icon (only on hover and when loaded) */}
        {imageLoaded && !imageError && (
          <div 
            className={`absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ pointerEvents: 'none' }}
          >
            <EyeIcon className="text-white" />
          </div>
        )}

        {/* Error state */}
        {imageError && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-400 text-xs"
            style={{ fontSize: '10px' }}
          >
            Image unavailable
          </div>
        )}
      </div>

      {/* Image popover */}
      {showPopover && imageLoaded && !imageError && createPortal(
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            border: '2px solid #10b981',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            padding: '8px',
            zIndex: 2000,
            maxWidth: '90vw',
            maxHeight: '90vh',
            pointerEvents: 'none',
          }}
        >
          <img
            src={`/api/places/photos/${photoRef}?width=600`}
            alt={placeName}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '400px',
              maxHeight: '400px',
              borderRadius: '8px',
              objectFit: 'cover',
              display: 'block',
            }}
            onError={(e) => {
              const target = e.target as HTMLElement;
              target.parentElement!.innerHTML = `
                <div style="
                  width: 300px;
                  height: 200px;
                  background: #f3f4f6;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #9ca3af;
                  font-size: 14px;
                ">
                  Large image unavailable
                </div>
              `;
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};