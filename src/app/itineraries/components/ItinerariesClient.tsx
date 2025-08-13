"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  MapPinIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ListBulletIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ItinerarySummary, deleteItinerary } from "@/features/data";
import { useItinerary } from "@/contexts/ItineraryContext";
import { generateItinerarySlug, ItineraryStats } from "@/utils/itinerary";
import { formatTimeAgo } from "@/utils/timeUtils";
import Image from "next/image";

interface ItinerariesClientProps {
  itineraries: ItinerarySummary[];
  itineraryStats: Record<string, ItineraryStats>;
  itineraryImages: Record<string, string[]>;
}

export default function ItinerariesClient({
  itineraries: initialItineraries,
  itineraryStats: initialItineraryStats,
  itineraryImages,
}: ItinerariesClientProps) {
  const router = useRouter();
  const { loadItinerary } = useItinerary();
  
  // Local state for interactive features
  const [itineraries, setItineraries] = useState(initialItineraries);
  const [itineraryStats, setItineraryStats] = useState(initialItineraryStats);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleCreateNew = () => {
    router.push("/create-itinerary");
  };

  const handleOpen = async (id: string) => {
    try {
      await loadItinerary(id);

      // Generate SEO-friendly URL with place names
      const stats = itineraryStats[id];
      const itinerary = itineraries.find((i) => i.id === id);

      console.log("🔍 Debug handleOpen:", {
        id,
        statsTitle: stats?.title,
        itineraryTitle: itinerary?.title,
        hasEditorData: !!itinerary?.editorData,
      });

      const slug = generateItinerarySlug(
        stats?.title || itinerary?.title || "untitled",
        id,
        itinerary?.editorData
      );

      console.log("Generated slug:", slug);
      console.log("Final URL:", `/editor/${slug}`);

      router.push(`/editor/${slug}`);
    } catch (err) {
      console.error("Error loading itinerary:", err);
      alert("Failed to load itinerary");
    }
  };

  const handleDeleteClick = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      setDeletingId(id);
      setShowDeleteConfirm(null);
      const response = await deleteItinerary(id);

      if (response.success) {
        // Remove from local state
        setItineraries((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(response.error || "Failed to delete itinerary");
      }
    } catch (err) {
      console.error("Error deleting itinerary:", err);
      alert("Failed to delete itinerary");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  const handleEditClick = (id: string) => {
    // Use the same priority as getDisplayTitle: database title first
    const currentName = getDisplayTitle(id);

    setEditingId(id);
    setEditingName(currentName);
  };

  // Helper function to get the current displayed title
  const getDisplayTitle = (id: string) => {
    const stats = itineraryStats[id];
    const itinerary = itineraries.find((i) => i.id === id);
    
    // Priority: database title first, then editor title, then default
    return itinerary?.title || stats?.title || "Untitled Itinerary";
  };

  const handleSaveName = async (id: string) => {
    const newTitle = editingName.trim();
    
    // Validation: Don't allow empty names
    if (!newTitle) {
      alert("Itinerary name cannot be empty");
      return;
    }
    
    // Don't update if the name hasn't changed
    const currentTitle = getDisplayTitle(id);
    if (newTitle === currentTitle) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    
    try {
      setUpdatingId(id);
      
      // Import and call server action to update itinerary name
      const { updateItineraryDetails } = await import("@/features/data");
      const result = await updateItineraryDetails(id, {
        title: newTitle,
      });

      if (result.success) {
        // Exit editing mode
        setEditingId(null);
        setEditingName("");
        
        // Update local state optimistically
        setItineraryStats(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            title: newTitle
          }
        }));
        
        setItineraries(prev => prev.map(itinerary => 
          itinerary.id === id 
            ? { ...itinerary, title: newTitle }
            : itinerary
        ));
      } else {
        alert(result.error || "Failed to update name");
      }
    } catch (error) {
      console.error("Error updating itinerary name:", error);
      alert("Failed to update name. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

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
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
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
          {itineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              className="card p-6 hover:shadow-lg transition-shadow"
            >
              {/* Actions */}
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs text-slate-500">
                  Updated {formatTimeAgo(new Date(itinerary.updatedAt))}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleOpen(itinerary.id)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Thumbnail Images */}
              <div className="bg-slate-200 rounded-lg h-32 mb-4 overflow-hidden relative">
                {itineraryImages[itinerary.id]?.length > 0 ? (
                  <div className="flex h-full">
                    {itineraryImages[itinerary.id]
                      .slice(0, 2)
                      .map((imageUrl, index) => {
                        // Simple check for non-empty URLs and skip invalid ones
                        if (!imageUrl || !imageUrl.trim()) {
                          return null;
                        }

                        // Skip URLs that might cause validation errors
                        if (
                          imageUrl.includes(" ") ||
                          imageUrl.includes("\n") ||
                          imageUrl.includes("\t")
                        ) {
                          return null;
                        }

                        const imageCount = itineraryImages[itinerary.id].length;
                        return (
                          <div
                            key={index}
                            className={`relative ${
                              imageCount === 1 ? "w-full" : "w-1/2"
                            } ${index > 0 ? "border-l border-slate-300" : ""}`}
                          >
                            <Image
                              src={"/api/places/photos/" + imageUrl}
                              alt={`Place ${index + 1}`}
                              fill
                              className="object-cover"
                              sizes={imageCount === 1 ? "100%" : "50%"}
                              unoptimized={true}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <MapPinIcon className="h-12 w-12 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                {/* Editable Title */}
                {editingId === itinerary.id ? (
                  <div className="mb-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        title="Itinerary name"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 text-lg font-semibold text-slate-900 border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (editingName.trim()) {
                              handleSaveName(itinerary.id);
                            }
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSaveName(itinerary.id)}
                        disabled={updatingId === itinerary.id || !editingName.trim()}
                        className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
                        title={!editingName.trim() ? "Name cannot be empty" : "Save"}
                      >
                        {updatingId === itinerary.id ? (
                          <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                        ) : (
                          <CheckIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 bg-slate-500 text-white rounded hover:bg-slate-600 flex-shrink-0"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <h3
                        className="text-lg font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleEditClick(itinerary.id)}
                      >
                        {getDisplayTitle(itinerary.id)}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleEditClick(itinerary.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 ml-2"
                      title="Edit name"
                    >
                      <PencilIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Stats with Icons */}
                <div className="flex items-center gap-4 mb-3">
                  {itineraryStats[itinerary.id]?.numberOfDays > 0 && (
                    <div className="flex items-center text-slate-600 text-sm">
                      <CalendarIcon className="h-4 w-4 mr-1 text-blue-500" />
                      <span className="font-medium">
                        {itineraryStats[itinerary.id].numberOfDays}
                      </span>
                      <span className="ml-1">days</span>
                    </div>
                  )}
                  {itineraryStats[itinerary.id]?.numberOfPlaces > 0 && (
                    <div className="flex items-center text-slate-600 text-sm">
                      <MapPinIcon className="h-4 w-4 mr-1 text-green-500" />
                      <span className="font-medium">
                        {itineraryStats[itinerary.id].numberOfPlaces}
                      </span>
                      <span className="ml-1">places</span>
                    </div>
                  )}
                </div>

                <p className="text-slate-500 text-xs mb-4">
                  Updated {formatTimeAgo(new Date(itinerary.updatedAt))}
                </p>
              </div>

              {/* Inline Delete Confirmation */}
              {showDeleteConfirm === itinerary.id && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <TrashIcon className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        Delete Itinerary
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>
                          Are you sure you want to delete &quot;
                          {getDisplayTitle(itinerary.id)}
                          &quot;? This action cannot be undone.
                        </p>
                      </div>
                      <div className="mt-4 flex space-x-2">
                        <button
                          onClick={() => handleDeleteConfirm(itinerary.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          className="bg-white text-red-600 px-3 py-2 border border-red-300 rounded-md text-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpen(itinerary.id)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDeleteClick(itinerary.id)}
                    disabled={deletingId === itinerary.id}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === itinerary.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State (if no itineraries) */}
        {itineraries.length === 0 && (
          <div className="text-center py-12">
            <ListBulletIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No itineraries yet
            </h3>
            <p className="text-slate-500 mb-6">
              Create your first travel itinerary to get started
            </p>
            <button
              onClick={handleCreateNew}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Your First Itinerary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}