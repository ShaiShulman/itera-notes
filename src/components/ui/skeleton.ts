/**
 * Skeleton component utilities for loading states
 * Similar to shadcn's skeleton component
 */

export function createSkeleton(width: string = "100%", height: string = "20px"): HTMLElement {
  // Add keyframes if not already added (do this first)
  if (!document.getElementById("skeleton-styles")) {
    const style = document.createElement("style");
    style.id = "skeleton-styles";
    style.textContent = `
      @keyframes skeleton-loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const skeleton = document.createElement("div");
  skeleton.className = "skeleton";
  skeleton.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${width};
    height: ${height};
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    border-radius: 4px;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    z-index: 1;
  `;
  
  return skeleton;
}

export function createImageSkeleton(width: string, height: string): HTMLElement {
  const skeleton = createSkeleton(width, height);
  skeleton.style.borderRadius = "6px";
  return skeleton;
}