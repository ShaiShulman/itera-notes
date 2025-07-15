// SVG icons for place types - optimized for 14x14px size
export const PLACE_TYPE_ICONS: Record<string, string> = {
  // Tourist attractions
  tourist_attraction: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L3.09 8.26L4 21h16l.91-12.74L12 2z" stroke="#0ea5e9" stroke-width="2" fill="none"/>
    <circle cx="12" cy="12" r="3" stroke="#0ea5e9" stroke-width="2" fill="none"/>
  </svg>`,

  // Museums
  museum: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21h18" stroke="#8b5cf6" stroke-width="2"/>
    <path d="M5 21V7l8-4v18" stroke="#8b5cf6" stroke-width="2" fill="none"/>
    <path d="M19 21V7l-8-4v18" stroke="#8b5cf6" stroke-width="2" fill="none"/>
  </svg>`,

  // Restaurants
  restaurant: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2v7c0 1.1.9 2 2 2h2v11h2V11h2c1.1 0 2-.9 2-2V2H3z" stroke="#ef4444" stroke-width="2" fill="none"/>
    <path d="M16 2v20h2V2h-2z" stroke="#ef4444" stroke-width="2"/>
  </svg>`,

  // Cafe
  cafe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke="#a855f7" stroke-width="2" fill="none"/>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke="#a855f7" stroke-width="2" fill="none"/>
  </svg>`,

  // Hotels/Lodging
  lodging: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 17h20v2H2v-2z" stroke="#f59e0b" stroke-width="2"/>
    <path d="M2 8h20v9H2V8z" stroke="#f59e0b" stroke-width="2" fill="none"/>
    <path d="M8 12h8v3H8v-3z" stroke="#f59e0b" stroke-width="2" fill="none"/>
  </svg>`,

  // Shopping
  store: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" stroke="#10b981" stroke-width="2" fill="none"/>
    <path d="M3 7l2-5h14l2 5-2 2H5l-2-2z" stroke="#10b981" stroke-width="2" fill="none"/>
  </svg>`,

  shopping_mall: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" stroke="#10b981" stroke-width="2" fill="none"/>
    <path d="M3 7l2-5h14l2 5-2 2H5l-2-2z" stroke="#10b981" stroke-width="2" fill="none"/>
  </svg>`,

  // Transportation
  transit_station: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 17h14v2H5v-2z" stroke="#6366f1" stroke-width="2"/>
    <path d="M3 6h18v9H3V6z" stroke="#6366f1" stroke-width="2" fill="none"/>
    <circle cx="7" cy="11" r="1" fill="#6366f1"/>
    <circle cx="17" cy="11" r="1" fill="#6366f1"/>
  </svg>`,

  // Religious places
  church: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2v20" stroke="#8b5cf6" stroke-width="2"/>
    <path d="M9 5h6" stroke="#8b5cf6" stroke-width="2"/>
    <path d="M6 9h12v11H6V9z" stroke="#8b5cf6" stroke-width="2" fill="none"/>
  </svg>`,

  synagogue: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l6 10v8H6v-8l6-10z" stroke="#8b5cf6" stroke-width="2" fill="none"/>
    <path d="M10 8l2-2 2 2-2 2-2-2z" stroke="#8b5cf6" stroke-width="2" fill="none"/>
  </svg>`,

  mosque: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l6 10v8H6v-8l6-10z" stroke="#8b5cf6" stroke-width="2" fill="none"/>
    <circle cx="12" cy="6" r="2" stroke="#8b5cf6" stroke-width="2" fill="none"/>
  </svg>`,

  // Parks and recreation
  park: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4c0-1.1.9-2 2-2s2 .9 2 2-2 3-2 3-2-1.9-2-3z" stroke="#22c55e" stroke-width="2" fill="none"/>
    <path d="M8 20V9c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v11" stroke="#22c55e" stroke-width="2" fill="none"/>
    <path d="M6 20h12" stroke="#22c55e" stroke-width="2"/>
  </svg>`,

  // Entertainment
  stadium: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#f59e0b" stroke-width="2" fill="none"/>
    <path d="M12 6v12" stroke="#f59e0b" stroke-width="2"/>
    <path d="M2 12h20" stroke="#f59e0b" stroke-width="2"/>
  </svg>`,

  movie_theater: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6h20v12H2V6z" stroke="#ec4899" stroke-width="2" fill="none"/>
    <path d="M8 2v4M16 2v4" stroke="#ec4899" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" stroke="#ec4899" stroke-width="2" fill="none"/>
  </svg>`,

  // Health & Services
  hospital: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 11h6M12 8v6" stroke="#dc2626" stroke-width="2"/>
    <path d="M3 3h18v18H3V3z" stroke="#dc2626" stroke-width="2" fill="none"/>
  </svg>`,

  pharmacy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 11h6M12 8v6" stroke="#059669" stroke-width="2"/>
    <circle cx="12" cy="12" r="9" stroke="#059669" stroke-width="2" fill="none"/>
  </svg>`,

  // Default icon for unknown types
  establishment: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#6b7280" stroke-width="2" fill="none"/>
    <circle cx="12" cy="10" r="3" stroke="#6b7280" stroke-width="2" fill="none"/>
  </svg>`,
};

// Function to get icon for a place type
export function getIconForPlaceType(types: string[]): string {
  // Priority order for icon selection
  const priorityTypes = [
    "lodging",
    "restaurant",
    "cafe",
    "tourist_attraction",
    "museum",
    "store",
    "shopping_mall",
    "transit_station",
    "church",
    "synagogue",
    "mosque",
    "park",
    "stadium",
    "movie_theater",
    "hospital",
    "pharmacy",
  ];

  for (const priority of priorityTypes) {
    if (types.includes(priority)) {
      return PLACE_TYPE_ICONS[priority];
    }
  }

  // Check for any type that has an icon
  for (const type of types) {
    if (PLACE_TYPE_ICONS[type]) {
      return PLACE_TYPE_ICONS[type];
    }
  }

  // Default fallback
  return PLACE_TYPE_ICONS.establishment;
}

// Function to get a readable name for place type
export function getPlaceTypeName(types: string[]): string {
  const typeNames: Record<string, string> = {
    lodging: "Hotel",
    restaurant: "Restaurant",
    cafe: "Cafe",
    tourist_attraction: "Attraction",
    museum: "Museum",
    store: "Store",
    shopping_mall: "Shopping",
    transit_station: "Transit",
    church: "Church",
    synagogue: "Synagogue",
    mosque: "Mosque",
    park: "Park",
    stadium: "Stadium",
    movie_theater: "Cinema",
    hospital: "Hospital",
    pharmacy: "Pharmacy",
    gas_station: "Gas Station",
    bank: "Bank",
    atm: "ATM",
    establishment: "Place",
  };

  // Priority order for name selection
  const priorityTypes = [
    "lodging",
    "restaurant",
    "cafe",
    "tourist_attraction",
    "museum",
    "store",
    "shopping_mall",
    "transit_station",
    "church",
    "synagogue",
    "mosque",
    "park",
    "stadium",
    "movie_theater",
    "hospital",
    "pharmacy",
  ];

  for (const priority of priorityTypes) {
    if (types.includes(priority)) {
      return typeNames[priority] || "Place";
    }
  }

  // Check for any type that has a name
  for (const type of types) {
    if (typeNames[type]) {
      return typeNames[type];
    }
  }

  return "Place";
}
