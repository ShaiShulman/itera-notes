import {
  PlusIcon,
  CalendarIcon,
  MapPinIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";

export default function NewItinerary() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <PlusIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Create New Itinerary
          </h1>
          <p className="text-lg text-slate-600">
            Tell us about your dream trip and we&apos;ll create a personalized
            itinerary for you
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-8 max-w-2xl mx-auto">
          <form className="space-y-8">
            {/* Destination */}
            <div>
              <label className="flex items-center text-lg font-medium text-slate-900 mb-3">
                <MapPinIcon className="h-5 w-5 mr-2 text-slate-600" />
                Where are you going?
              </label>
              <input
                type="text"
                placeholder="Enter destination (e.g., Tokyo, Japan)"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="start-date"
                  className="flex items-center text-lg font-medium text-slate-900 mb-3"
                >
                  <CalendarIcon className="h-5 w-5 mr-2 text-slate-600" />
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="flex items-center text-lg font-medium text-slate-900 mb-3"
                >
                  <CalendarIcon className="h-5 w-5 mr-2 text-slate-600" />
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="flex items-center text-lg font-medium text-slate-900 mb-3">
                <HeartIcon className="h-5 w-5 mr-2 text-slate-600" />
                What are your interests?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  "Museums & Art",
                  "Food & Dining",
                  "Nature & Parks",
                  "History & Culture",
                  "Shopping",
                  "Nightlife",
                  "Architecture",
                  "Adventure Sports",
                  "Photography",
                ].map((interest) => (
                  <label key={interest} className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">
                      {interest}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Travel Style */}
            <div>
              <label
                htmlFor="travel-style"
                className="text-lg font-medium text-slate-900 mb-3 block"
              >
                Travel Style
              </label>
              <select
                id="travel-style"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select your travel style</option>
                <option value="budget">Budget-friendly</option>
                <option value="mid-range">Mid-range</option>
                <option value="luxury">Luxury</option>
                <option value="backpacker">Backpacker</option>
                <option value="family">Family-friendly</option>
              </select>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="text-lg font-medium text-slate-900 mb-3 block">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={4}
                placeholder="Any specific requests, accessibility needs, or preferences..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              ></textarea>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Generate My Itinerary
              </button>
              <button
                type="button"
                className="flex-1 border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Save as Draft
              </button>
            </div>
          </form>
        </div>

        {/* AI Notice */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Powered by OpenAI • Your itinerary will be generated in seconds
          </p>
        </div>
      </div>
    </div>
  );
}
