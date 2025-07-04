import {
  Cog6ToothIcon,
  UserIcon,
  BellIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Cog6ToothIcon className="h-8 w-8 text-slate-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1">
              Manage your account and application preferences
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="card p-6">
              <nav className="space-y-2">
                {[
                  { icon: UserIcon, label: "Profile", active: true },
                  { icon: BellIcon, label: "Notifications" },
                  { icon: GlobeAltIcon, label: "Preferences" },
                  { icon: PaintBrushIcon, label: "Appearance" },
                  { icon: ShieldCheckIcon, label: "Privacy" },
                  { icon: KeyIcon, label: "Security" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      className={`w-full flex items-center px-3 py-2 text-left rounded-lg transition-colors ${
                        item.active
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Profile Settings
              </h2>

              <form className="space-y-6">
                {/* Profile Photo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
                      <UserIcon className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                        Change Photo
                      </button>
                      <p className="text-xs text-slate-500 mt-1">
                        JPG, PNG or GIF. Max size 2MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      id="first-name"
                      defaultValue="John"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="last-name"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="last-name"
                      defaultValue="Doe"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    defaultValue="john.doe@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Travel Preferences */}
                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-medium text-slate-900 mb-4">
                    Travel Preferences
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="home-location"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Home Location
                      </label>
                      <input
                        type="text"
                        id="home-location"
                        placeholder="e.g., New York, NY"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Preferred Currency
                      </label>
                      <select
                        id="currency"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="language"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Language
                      </label>
                      <select
                        id="language"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Default Travel Style
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {["Budget", "Mid-range", "Luxury", "Backpacker"].map(
                          (style) => (
                            <label key={style} className="flex items-center">
                              <input
                                type="radio"
                                name="travel-style"
                                value={style.toLowerCase()}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                              <span className="ml-2 text-sm text-slate-700">
                                {style}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notification Settings */}
                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-medium text-slate-900 mb-4">
                    Notifications
                  </h3>

                  <div className="space-y-3">
                    {[
                      {
                        label: "Email notifications for new features",
                        checked: true,
                      },
                      {
                        label: "Push notifications for trip reminders",
                        checked: false,
                      },
                      {
                        label: "Weekly travel inspiration emails",
                        checked: true,
                      },
                      { label: "Collaboration updates", checked: true },
                    ].map((setting, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-700">
                          {setting.label}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={setting.checked}
                            aria-label={setting.label}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-slate-200">
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      className="px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
