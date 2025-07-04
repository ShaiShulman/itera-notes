import {
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
  PhotoIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

// Mock data for demonstration
const mockPlaces = [
  {
    id: 1,
    name: "Tokyo Skytree",
    address: "1 Chome-1-2 Oshiage, Sumida City, Tokyo, Japan",
    rating: 4.5,
    category: "Landmark",
    description:
      "A broadcasting and observation tower in Tokyo, Japan. It is the tallest tower in the world.",
    imageCount: 245,
    priceLevel: "$$",
  },
  {
    id: 2,
    name: "Senso-ji Temple",
    address: "2 Chome-3-1 Asakusa, Taito City, Tokyo, Japan",
    rating: 4.6,
    category: "Temple",
    description:
      "An ancient Buddhist temple located in Asakusa, Tokyo. It is the oldest temple in Tokyo.",
    imageCount: 189,
    priceLevel: "Free",
  },
  {
    id: 3,
    name: "Tsukiji Outer Market",
    address: "Tsukiji, Chuo City, Tokyo, Japan",
    rating: 4.3,
    category: "Market",
    description:
      "Famous fish market with fresh seafood and traditional Japanese food stalls.",
    imageCount: 156,
    priceLevel: "$$",
  },
];

const categories = [
  "All",
  "Landmarks",
  "Temples",
  "Museums",
  "Parks",
  "Markets",
  "Restaurants",
  "Shopping",
];

export default function PlaceExplorer() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <MagnifyingGlassIcon className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Place Explorer
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Discover amazing places around the world and add them to your
            itineraries
          </p>
        </div>

        {/* Search */}
        <div className="card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search for places, attractions, restaurants..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                aria-label="Select city"
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              >
                <option value="">Select City</option>
                <option value="tokyo">Tokyo, Japan</option>
                <option value="paris">Paris, France</option>
                <option value="nyc">New York, USA</option>
                <option value="london">London, UK</option>
              </select>
              <button className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === "All"
                    ? "bg-green-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-slate-900">
              Search Results{" "}
              <span className="text-slate-500 font-normal">
                ({mockPlaces.length} places)
              </span>
            </h3>
            <select
              aria-label="Sort results"
              className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="relevance">Sort by Relevance</option>
              <option value="rating">Highest Rated</option>
              <option value="distance">Nearest</option>
              <option value="price">Price</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mockPlaces.map((place) => (
              <div
                key={place.id}
                className="card p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Image Placeholder */}
                  <div className="flex-shrink-0 w-24 h-24 bg-slate-200 rounded-lg flex items-center justify-center">
                    <PhotoIcon className="h-8 w-8 text-slate-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-lg font-semibold text-slate-900 truncate">
                        {place.name}
                      </h4>
                      <button
                        className="ml-2 p-1 text-slate-400 hover:text-green-600 transition-colors"
                        title="Add to itinerary"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        <StarIcon className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium text-slate-700 ml-1">
                          {place.rating}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="text-sm text-slate-600">
                        {place.category}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-sm text-green-600 font-medium">
                        {place.priceLevel}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {place.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-slate-500">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        <span className="truncate">
                          {place.address.split(",")[0]}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-slate-500">
                        <PhotoIcon className="h-4 w-4 mr-1" />
                        <span>{place.imageCount} photos</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex gap-2">
                    <button className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
                      View Details
                    </button>
                    <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                      Add to Itinerary
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map View Toggle */}
        <div className="text-center">
          <button className="bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
            <MapPinIcon className="h-5 w-5 inline mr-2" />
            View on Map
          </button>
        </div>

        {/* Integration Notice */}
        <div className="mt-12 card p-6 bg-blue-50 border-blue-200">
          <div className="text-center">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Google Places Integration
            </h3>
            <p className="text-blue-700 text-sm">
              This page will be powered by Google Places API to provide
              real-time place data, photos, and reviews.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
