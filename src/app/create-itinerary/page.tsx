"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AuthProtected } from "@/features/auth/components/AuthProtected";
import {
  CreateItineraryProvider,
  useCreateItineraryForm,
} from "@/contexts/CreateItineraryContext";
import { convertItineraryToEditorData } from "./utils/editorConverter";
import { useSecureApi } from "@/hooks/useSecureApi";
import {
  PlusIcon,
  CalendarIcon,
  MapPinIcon,
  HeartIcon,
  XMarkIcon,
  SparklesIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import {
  newItinerarySchema,
  type NewItineraryForm,
  DEFAULT_INTERESTS,
  TRAVEL_STYLES,
  TRANSPORT_OPTIONS,
} from "./types";

interface FormErrors {
  [key: string]: string;
}

function NewItineraryForm() {
  const router = useRouter();
  const { state, setEditorData, setDirectionsData, setFormMetadata } =
    useItinerary();
  const { formData, updateFormData, isFormDirty } = useCreateItineraryForm();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [newInterest, setNewInterest] = useState("");
  const { secureStream, error: securityError, clearError } = useSecureApi();

  // Wikipedia enrichment progress
  const [enrichmentPlaces, setEnrichmentPlaces] = useState<Array<{ name: string; found: boolean }>>([]);
  const [enrichmentStats, setEnrichmentStats] = useState<{ found: number; total: number } | null>(null);

  // Handle cancellation of itinerary generation
  const handleCancel = () => {
    // Reset all loading states
    setIsLoading(false);
    setLoadingMessage("");
    setEnrichmentPlaces([]);
    setEnrichmentStats(null);
  };

  // Handle form field changes
  const handleInputChange = (field: keyof NewItineraryForm, value: any) => {
    updateFormData(field, value);
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Handle interest selection
  const toggleInterest = (interest: string) => {
    const currentInterests = formData.interests || [];
    const isSelected = currentInterests.includes(interest);

    if (isSelected) {
      handleInputChange(
        "interests",
        currentInterests.filter((i) => i !== interest)
      );
    } else {
      handleInputChange("interests", [...currentInterests, interest]);
    }
  };

  // Add custom interest
  const addCustomInterest = () => {
    if (
      newInterest.trim() &&
      !(formData.interests || []).includes(newInterest.trim())
    ) {
      handleInputChange("interests", [
        ...(formData.interests || []),
        newInterest.trim(),
      ]);
      setNewInterest("");
    }
  };

  // Remove interest
  const removeInterest = (interest: string) => {
    handleInputChange(
      "interests",
      (formData.interests || []).filter((i) => i !== interest)
    );
  };

  // Handle multi-step streaming with progress updates
  const handleMultiStepStreaming = async (validatedData: any) => {
    console.log("🚀 Starting multi-step streaming with progress updates");
    setLoadingMessage("Generating skeleton itinerary...");
    setEnrichmentPlaces([]);
    setEnrichmentStats(null);

    try {
      await secureStream(
        "/api/generate-itinerary-multistep-stream",
        validatedData,
        (chunk: string) => {
          // Process progress updates (one JSON per line)
          const lines = chunk.trim().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const progress = JSON.parse(line);

              // Handle different progress types
              if (progress.type === "skeleton_generating") {
                setLoadingMessage("Generating skeleton itinerary...");
              } else if (progress.type === "skeleton_generated") {
                setLoadingMessage(`Skeleton generated with ${progress.placesCount} places. Enriching with Wikipedia...`);
              } else if (progress.type === "place_enriched") {
                setLoadingMessage(`Enriching ${progress.placeName} with Wikipedia...`);
                setEnrichmentPlaces((prev) => [
                  ...prev,
                  { name: progress.placeName, found: progress.found },
                ]);
              } else if (progress.type === "statistics") {
                setEnrichmentStats({
                  found: progress.foundCount,
                  total: progress.totalCount,
                });
                setLoadingMessage("Creating final itinerary...");
              }
            } catch (parseError) {
              console.warn("Failed to parse progress update:", line);
            }
          }
        }
      );

      console.log("✅ Multi-step streaming complete, now calling non-streaming action to get final result");

      // After streaming completes, call the non-streaming action to get the final result
      const { generateItineraryAction } = await import(
        "@/features/generateLLM/generateAction"
      );

      const actionResult = await generateItineraryAction(validatedData);

      if (actionResult.success && actionResult.data) {
        // Convert to editor data format
        const editorData = convertItineraryToEditorData(
          actionResult.data,
          true
        );

        // Store form metadata in context
        setFormMetadata({
          destination: validatedData.destination,
          startDate: new Date(validatedData.startDate),
          endDate: new Date(validatedData.endDate),
          interests: validatedData.interests,
          travelStyle: validatedData.travelStyle,
          additionalNotes: validatedData.additionalNotes || undefined,
        });

        setEditorData(editorData);

        if (actionResult.directions) {
          setDirectionsData(actionResult.directions);
        }

        setLoadingMessage("Saving to database and preparing editor...");

        // Wait for auto-save
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts && !state.currentItineraryId) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        if (state.currentItineraryId) {
          const { generateItinerarySlug } = await import("@/utils/itinerary");
          const title = actionResult.data.title || "New Itinerary";
          const slug = generateItinerarySlug(
            title,
            state.currentItineraryId,
            editorData
          );

          if (typeof window !== "undefined") {
            sessionStorage.setItem("fresh-from-create", "true");
            sessionStorage.setItem(
              "fresh-from-create-timestamp",
              Date.now().toString()
            );
            sessionStorage.setItem(
              "fresh-itinerary-id",
              state.currentItineraryId
            );
          }

          router.push(`/editor/${slug}`);
          return;
        } else {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("fresh-from-create", "true");
            sessionStorage.setItem(
              "fresh-from-create-timestamp",
              Date.now().toString()
            );
          }

          router.push("/editor");
          return;
        }
      } else {
        throw new Error(actionResult.error || "Failed to generate itinerary");
      }
    } catch (fallbackError) {
      console.error("Fallback generation also failed:", fallbackError);
      throw fallbackError;
    }
  };

  // Handle form submission with multi-step Wikipedia enrichment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data
    const result = newItinerarySchema.safeParse(formData);

    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.errors.forEach((error) => {
        const field = error.path[0] as string;
        newErrors[field] = error.message;
      });
      setErrors(newErrors);
      return;
    }

    try {
      // Use multi-step Wikipedia-enriched generation with streaming progress
      setIsLoading(true);
      setLoadingMessage(
        "Creating your personalized itinerary with Wikipedia enrichment..."
      );

      console.log("🚀 Starting multi-step Wikipedia-enriched generation");
      await handleMultiStepStreaming(result.data);
      return;
    } catch (error) {
      console.error("Error generating itinerary:", error);
      setErrors({ submit: "Failed to generate itinerary. Please try again." });

      setIsLoading(false);
      setLoadingMessage("");
      setEnrichmentPlaces([]);
      setEnrichmentStats(null);
    }
  };

  // Get today's date for date input min values
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 relative">
        {/* Loading Overlay */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center bg-white/70">
          <div className="text-center bg-white/90 p-8 rounded-2xl shadow-lg border border-white/50">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <SparklesIcon className="h-10 w-10 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Generating Your Itinerary
            </h2>
            <p className="text-lg text-slate-600 mb-8">{loadingMessage}</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              This may take a few moments...
            </p>

            {/* Wikipedia Enrichment Progress */}
            {enrichmentPlaces.length > 0 && (
              <div className="mt-6 text-left max-w-md mx-auto">
                <h3 className="text-sm font-medium text-slate-700 mb-3">
                  Enriching places with Wikipedia:
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-50 rounded-lg p-3">
                  {enrichmentPlaces.map((place, index) => (
                    <div
                      key={index}
                      className="flex items-center text-sm"
                    >
                      <span className="mr-2">
                        {place.found ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-slate-400">○</span>
                        )}
                      </span>
                      <span
                        className={
                          place.found ? "text-slate-700" : "text-slate-500"
                        }
                      >
                        {place.name}
                      </span>
                    </div>
                  ))}
                </div>
                {enrichmentStats && (
                  <p className="text-xs text-slate-600 mt-2 text-center">
                    Found Wikipedia articles for {enrichmentStats.found} of{" "}
                    {enrichmentStats.total} places
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cancel Button */}
          <div className="mt-8">
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-lg"
            >
              Cancel Generation
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {isFormDirty && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Unsaved changes
              </span>
            )}
          </h1>
          <p className="text-lg text-slate-600">
            Tell us about your dream trip and we&apos;ll create a personalized
            itinerary for you
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-8 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Destination */}
            <div>
              <label className="flex items-center text-lg font-medium text-slate-900 mb-3">
                <MapPinIcon className="h-5 w-5 mr-2 text-slate-600" />
                Where are you going? *
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) =>
                  handleInputChange("destination", e.target.value)
                }
                placeholder="Enter destination (e.g., Tokyo, Japan)"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.destination ? "border-red-500" : "border-slate-300"
                }`}
              />
              {errors.destination && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.destination}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="start-date"
                  className="flex items-center text-lg font-medium text-slate-900 mb-3"
                >
                  <CalendarIcon className="h-5 w-5 mr-2 text-slate-600" />
                  Start Date *
                </label>
                <input
                  id="start-date"
                  type="date"
                  min={today}
                  value={formData.startDate}
                  onChange={(e) =>
                    handleInputChange("startDate", e.target.value)
                  }
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.startDate ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {errors.startDate && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.startDate}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="flex items-center text-lg font-medium text-slate-900 mb-3"
                >
                  <CalendarIcon className="h-5 w-5 mr-2 text-slate-600" />
                  End Date *
                </label>
                <input
                  id="end-date"
                  type="date"
                  min={formData.startDate || today}
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.endDate ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {errors.endDate && (
                  <p className="mt-2 text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="flex items-center text-lg font-medium text-slate-900 mb-3">
                <HeartIcon className="h-5 w-5 mr-2 text-slate-600" />
                What are your interests? *
              </label>

              {/* Selected interests */}
              {(formData.interests || []).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">
                    Selected interests:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(formData.interests || []).map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {interest}
                        <button
                          type="button"
                          onClick={() => removeInterest(interest)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          aria-label={`Remove ${interest} interest`}
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Default interests */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {DEFAULT_INTERESTS.map((interest) => {
                  const isSelected = (formData.interests || []).includes(
                    interest
                  );
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-colors ${
                        isSelected
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{interest}</span>
                      {isSelected && (
                        <CheckIcon className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Add custom interest */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    (e.preventDefault(), addCustomInterest())
                  }
                  placeholder="Add custom interest..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addCustomInterest}
                  disabled={!newInterest.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>

              {errors.interests && (
                <p className="mt-2 text-sm text-red-600">{errors.interests}</p>
              )}
            </div>

            {/* Travel Style */}
            <div>
              <label
                htmlFor="travel-style"
                className="text-lg font-medium text-slate-900 mb-3 block"
              >
                Travel Style *
              </label>
              <select
                id="travel-style"
                value={formData.travelStyle || ""}
                onChange={(e) =>
                  handleInputChange("travelStyle", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.travelStyle ? "border-red-500" : "border-slate-300"
                }`}
              >
                <option value="" className="text-black">
                  Select your travel style
                </option>
                {TRAVEL_STYLES.map((style) => (
                  <option
                    className="text-black"
                    key={style.value}
                    value={style.value}
                  >
                    {style.label} - {style.description}
                  </option>
                ))}
              </select>
              {errors.travelStyle && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.travelStyle}
                </p>
              )}
            </div>

            {/* Transport Preference */}
            <div>
              <label className="text-lg font-medium text-slate-900 mb-3 block">
                Preferred Transportation
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TRANSPORT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors hover:bg-slate-50 ${
                      formData.transportPreference === option.value
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                        : errors.transportPreference
                        ? "border-red-500"
                        : "border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="transportPreference"
                      value={option.value}
                      checked={formData.transportPreference === option.value}
                      onChange={(e) =>
                        handleInputChange("transportPreference", e.target.value)
                      }
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        {option.iconPath ? (
                          <Image
                            src={option.iconPath}
                            alt={`${option.label} icon`}
                            width={18}
                            height={18}
                            className="w-[18px] h-[18px]"
                          />
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{ __html: option.icon }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {option.label}
                        </div>
                        <div className="text-sm text-slate-600">
                          {option.description}
                        </div>
                      </div>
                    </div>
                    {formData.transportPreference === option.value && (
                      <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                        <svg
                          className="h-3 w-3 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </label>
                ))}
              </div>
              {errors.transportPreference && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.transportPreference}
                </p>
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="text-lg font-medium text-slate-900 mb-3 block">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={4}
                value={formData.additionalNotes}
                onChange={(e) =>
                  handleInputChange("additionalNotes", e.target.value)
                }
                placeholder="Any specific requests, accessibility needs, or preferences..."
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                  errors.additionalNotes ? "border-red-500" : "border-slate-300"
                }`}
              />
              {errors.additionalNotes && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.additionalNotes}
                </p>
              )}
            </div>

            {/* Form submit error */}
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <SparklesIcon className="h-5 w-5" />
                Generate My Itinerary
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

export default function NewItinerary() {
  return (
    <AuthProtected>
      <CreateItineraryProvider>
        <NewItineraryForm />
      </CreateItineraryProvider>
    </AuthProtected>
  );
}
