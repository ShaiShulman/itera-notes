import {
  ListBulletIcon,
  CalendarIcon,
  MapPinIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Mock data for demonstration
const mockItineraries = [
  {
    id: 1,
    title: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    startDate: "2024-03-15",
    endDate: "2024-03-22",
    days: 7,
    places: 12,
    status: "completed",
    thumbnail: "/placeholder-tokyo.jpg",
  },
  {
    id: 2,
    title: "Paris Getaway",
    destination: "Paris, France",
    startDate: "2024-04-10",
    endDate: "2024-04-17",
    days: 7,
    places: 15,
    status: "draft",
    thumbnail: "/placeholder-paris.jpg",
  },
  {
    id: 3,
    title: "New York City Break",
    destination: "New York, USA",
    startDate: "2024-05-01",
    endDate: "2024-05-05",
    days: 4,
    places: 8,
    status: "planning",
    thumbnail: "/placeholder-nyc.jpg",
  },
];

export default function MyItineraries() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <ListBulletIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                My Itineraries
              </h1>
              <p className="text-slate-600 mt-1">
                Manage and organize your travel plans
              </p>
            </div>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            Create New Itinerary
          </button>
        </div>

        {/* Filters */}
        <div className="card p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <label
                htmlFor="status-filter"
                className="text-sm font-medium text-slate-700"
              >
                Status:
              </label>
              <select
                id="status-filter"
                className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="planning">Planning</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label
                htmlFor="sort-by"
                className="text-sm font-medium text-slate-700"
              >
                Sort by:
              </label>
              <select
                id="sort-by"
                className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="recent">Most Recent</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="date">Travel Date</option>
              </select>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2">
              <input
                type="search"
                placeholder="Search itineraries..."
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Itineraries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockItineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              className="card p-6 hover:shadow-lg transition-shadow"
            >
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    itinerary.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : itinerary.status === "draft"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {itinerary.status.charAt(0).toUpperCase() +
                    itinerary.status.slice(1)}
                </span>
                <div className="flex space-x-1">
                  <button
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="View"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1 text-slate-400 hover:text-red-600"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Thumbnail Placeholder */}
              <div className="bg-slate-200 rounded-lg h-32 mb-4 flex items-center justify-center">
                <MapPinIcon className="h-12 w-12 text-slate-400" />
              </div>

              {/* Content */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {itinerary.title}
                </h3>
                <p className="text-slate-600 text-sm mb-3 flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" />
                  {itinerary.destination}
                </p>

                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {new Date(itinerary.startDate).toLocaleDateString()} -{" "}
                    {new Date(itinerary.endDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex justify-between text-sm text-slate-600">
                  <span>{itinerary.days} days</span>
                  <span>{itinerary.places} places</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex space-x-2">
                  <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                    Open
                  </button>
                  <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                    Share
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State (if no itineraries) */}
        {mockItineraries.length === 0 && (
          <div className="text-center py-12">
            <ListBulletIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No itineraries yet
            </h3>
            <p className="text-slate-500 mb-6">
              Create your first travel itinerary to get started
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Create Your First Itinerary
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
            <div className="text-sm text-slate-600">Total Itineraries</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">18</div>
            <div className="text-sm text-slate-600">Total Days Planned</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">35</div>
            <div className="text-sm text-slate-600">Places to Visit</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">1</div>
            <div className="text-sm text-slate-600">Trips Completed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
