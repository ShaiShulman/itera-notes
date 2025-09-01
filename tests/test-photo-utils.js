// Test photo utilities in browser console
// Paste this in browser dev tools to test photo URL generation

console.log('Testing photo utilities...');

// Simulate the photo settings
const PHOTO_SETTINGS = {
  THUMBNAIL_SIZE: 150,
  DEFAULT_SIZE: 250,
  POPUP_SIZE: 400,
  MASTER_SIZE: 500
};

// Test functions
function getPhotoSize(size) {
  switch (size) {
    case 'thumbnail': return PHOTO_SETTINGS.THUMBNAIL_SIZE;
    case 'default': return PHOTO_SETTINGS.DEFAULT_SIZE;
    case 'popup': return PHOTO_SETTINGS.POPUP_SIZE;
    case 'master': return PHOTO_SETTINGS.MASTER_SIZE;
    default: return PHOTO_SETTINGS.DEFAULT_SIZE;
  }
}

function isValidPhotoSize(size) {
  return [150, 250, 400, 500].includes(size);
}

function getPlacePhotoUrl(photoReference, size = 'default') {
  const width = typeof size === 'string' ? getPhotoSize(size) : size;
  
  if (!isValidPhotoSize(width)) {
    console.warn(`Invalid width ${width}px, using default`);
    return `/api/places/photos/${photoReference}?width=${PHOTO_SETTINGS.DEFAULT_SIZE}`;
  }
  
  return `/api/places/photos/${photoReference}?width=${width}`;
}

function getPlacePhotoThumbnailUrl(photoReference) {
  return getPlacePhotoUrl(photoReference, 'thumbnail');
}

// Test with sample data
const testPhotoRef = 'AtCoDuDE1234567890ABCDEF_test_reference';

console.log('Test URLs:');
console.log('Thumbnail:', getPlacePhotoThumbnailUrl(testPhotoRef));
console.log('Default:', getPlacePhotoUrl(testPhotoRef));
console.log('Popup:', getPlacePhotoUrl(testPhotoRef, 'popup'));

// Test validation
console.log('Validations:');
console.log('Valid photo ref (>10 chars):', testPhotoRef.length > 10);
console.log('Valid size 150:', isValidPhotoSize(150));
console.log('Valid size 300:', isValidPhotoSize(300)); // Should be false

console.log('Photo utilities test complete!');