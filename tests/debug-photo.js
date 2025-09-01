// Debug photo system - simple test
console.log('Testing photo system components...');

// Test 1: PHOTO_SETTINGS import
try {
  const photoSettings = require('./src/services/google/photoSettings.ts');
  console.log('✅ Photo settings loaded');
} catch (error) {
  console.log('❌ Photo settings error:', error.message);
}

// Test 2: Sharp import
try {
  const sharp = require('sharp');
  console.log('✅ Sharp loaded');
} catch (error) {
  console.log('❌ Sharp error:', error.message);
}

// Test 3: Check if API route file has syntax errors
const fs = require('fs');
const path = require('path');

try {
  const routePath = path.join(__dirname, 'src/app/api/places/photos/[reference]/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf8');
  
  // Simple syntax checks
  const hasRequiredImports = [
    'googlePhotosService',
    'resizeWithRetry',
    'PHOTO_SETTINGS',
    'shouldResize',
    'isValidPhotoSize'
  ].every(item => routeContent.includes(item));
  
  console.log('✅ API route file exists and has required imports:', hasRequiredImports);
  
  // Check for basic syntax issues
  const openBraces = (routeContent.match(/{/g) || []).length;
  const closeBraces = (routeContent.match(/}/g) || []).length;
  console.log('✅ Braces balanced:', openBraces === closeBraces);
  
} catch (error) {
  console.log('❌ API route check error:', error.message);
}

console.log('Debug complete. Check server logs for runtime errors.');