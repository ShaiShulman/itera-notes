// Add this to browser console to debug place data
console.log('Debugging place data...');

// Check if we have any place blocks on the page
const placeBlocks = document.querySelectorAll('.place-block, .hotel-block');
console.log(`Found ${placeBlocks.length} place blocks`);

placeBlocks.forEach((block, index) => {
  console.log(`Block ${index + 1}:`);
  
  // Check if block has data attributes
  const uid = block.getAttribute('data-uid');
  const lat = block.getAttribute('data-lat');
  const lng = block.getAttribute('data-lng');
  
  console.log(`  - UID: ${uid}`);
  console.log(`  - Coordinates: ${lat}, ${lng}`);
  
  // Look for thumbnail images
  const thumbnails = block.querySelectorAll('img[src*="/api/places/photos/"]');
  console.log(`  - Thumbnail images found: ${thumbnails.length}`);
  
  thumbnails.forEach((img, imgIndex) => {
    console.log(`    Thumbnail ${imgIndex + 1}: ${img.src}`);
    console.log(`    Natural size: ${img.naturalWidth}x${img.naturalHeight}`);
    console.log(`    Loaded: ${img.complete && img.naturalHeight !== 0}`);
    if (!img.complete || img.naturalHeight === 0) {
      console.log(`    Error: ${img.onerror ? 'onerror fired' : 'loading or failed'}`);
    }
  });
  
  // Look for larger images in expanded view
  const largeImages = block.querySelectorAll('img[src*="/api/places/photos/"][src*="width=400"]');
  console.log(`  - Large images found: ${largeImages.length}`);
});

// Check network requests for photos
console.log('\\nTo see network requests:');
console.log('1. Open Network tab in DevTools');
console.log('2. Filter by "photos" or "api"');
console.log('3. Look for failed requests (red status)');
console.log('4. Check response details for error messages');