"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AuthProtected } from "@/features/auth/components/AuthProtected";
import {
  CreateItineraryProvider,
  useCreateItineraryForm,
} from "@/contexts/CreateItineraryContext";
import { convertItineraryToEditorData } from "./utils/editorConverter";
import { createStreamingParser } from "@/features/generateLLM/previewParser";
import type { PreviewLine } from "@/features/generateLLM/types";
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
} from "./types";

interface FormErrors {
  [key: string]: string;
}

function NewItineraryForm() {
  const router = useRouter();
  const { state, setEditorData, setDirectionsData, setFormMetadata } = useItinerary();
  const { formData, updateFormData, isFormDirty } = useCreateItineraryForm();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [newInterest, setNewInterest] = useState("");
  const [streamingLines, setStreamingLines] = useState<PreviewLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingFailedWarning, setStreamingFailedWarning] = useState<string | null>(null);
  const streamingContainerRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef(createStreamingParser());
  const abortControllerRef = useRef<AbortController | null>(null);
  const { secureStream, error: securityError, clearError, isAuthenticated } = useSecureApi();

  // Handle cancellation of itinerary generation
  const handleCancel = () => {
    if (abortControllerRef.current) {
      console.log("🛑 Cancelling itinerary generation...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset all loading states
    setIsLoading(false);
    setIsStreaming(false);
    setLoadingMessage("");
    setStreamingLines([]);
    setStreamingFailedWarning(null);
    parserRef.current.reset();
  };

  // Handle form field changes
  const handleInputChange = (field: keyof NewItineraryForm, value: any) => {
    updateFormData(field, value);
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    // Clear security errors when user makes changes
    if (securityError) {
      clearError();
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

  // Handle streaming content with secure API
  const handleSecureStreaming = async (formData: any, abortSignal: AbortSignal): Promise<string | null> => {
    let fullContent = "";
    let streamingFailed = false;

    try {
      await secureStream(
        "/api/generate-itinerary-stream",
        formData,
        (chunk: string) => {
          // Check if cancelled before processing chunk
          if (abortSignal.aborted) {
            throw new Error("Operation was cancelled");
          }

          // Check if streaming failed
          if (chunk.startsWith('STREAMING_FAILED:')) {
            const errorMessage = chunk.replace('STREAMING_FAILED:', '').trim();
            console.warn("🔄 Streaming failed, showing warning and falling back:", errorMessage);
            setStreamingFailedWarning(`Streaming encountered an issue: ${errorMessage}. Continuing with standard generation...`);
            streamingFailed = true;
            return; // Don't throw, just mark as failed and return
          }

          fullContent += chunk;

          // Process chunk through preview parser
          const newLines = parserRef.current.addContent(chunk);

          if (newLines.length > 0) {
            setStreamingLines(prev => [...prev, ...newLines]);

            // Auto-scroll to bottom of streaming container
            setTimeout(() => {
              if (streamingContainerRef.current) {
                streamingContainerRef.current.scrollTop = streamingContainerRef.current.scrollHeight;
              }
            }, 0);
          }
        },
        abortSignal
      );

      // Check if streaming failed during the process
      if (streamingFailed) {
        return null; // Signal that streaming failed and fallback is needed
      }

      // Finalize any remaining content if not cancelled
      if (!abortSignal.aborted) {
        const finalLines = parserRef.current.finalize();
        if (finalLines.length > 0) {
          setStreamingLines(prev => [...prev, ...finalLines]);
        }
      }

      return fullContent;
    } catch (error) {
      // Handle other streaming errors (not the STREAMING_FAILED case)
      if (error instanceof Error && error.message === "Operation was cancelled") {
        throw error; // Re-throw cancellation errors
      }

      // For other errors, set a warning and signal fallback
      console.warn("🔄 Streaming encountered an error, falling back:", error);
      setStreamingFailedWarning(`Streaming encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing with standard generation...`);
      return null; // Signal fallback needed
    }
  };

  // Fallback to non-streaming generation
  const handleFallbackGeneration = async (validatedData: any) => {
    console.log("🔄 Falling back to non-streaming generation");
    setLoadingMessage("Creating your personalized itinerary (standard mode)...");
    setIsStreaming(false);
    setStreamingLines([]);

    // If no warning is set yet, set a generic one
    if (!streamingFailedWarning) {
      setStreamingFailedWarning("Streaming mode unavailable. Continuing with standard generation...");
    }

    try {
      // Import the original server action as fallback
      const { generateItineraryAction } = await import("@/features/generateLLM/generateAction");

      const actionResult = await generateItineraryAction(validatedData);

      if (actionResult.success && actionResult.data) {
        // Convert to editor data format
        const editorData = convertItineraryToEditorData(actionResult.data, true);

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
          const slug = generateItinerarySlug(title, state.currentItineraryId, editorData);
          
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('fresh-from-create', 'true');
            sessionStorage.setItem('fresh-from-create-timestamp', Date.now().toString());
            sessionStorage.setItem('fresh-itinerary-id', state.currentItineraryId);
          }
          
          router.push(`/editor/${slug}`);
          return;
        } else {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('fresh-from-create', 'true');
            sessionStorage.setItem('fresh-from-create-timestamp', Date.now().toString());
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

  // Handle form submission with secure streaming and fallback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Check authentication first
    if (!isAuthenticated) {
      setErrors({ submit: "Please log in to generate an itinerary." });
      return;
    }

    // Clear any previous security errors
    if (securityError) {
      clearError();
    }

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
      // Reset streaming state and start streaming
      setIsLoading(true);
      setIsStreaming(true);
      setStreamingLines([]);
      setLoadingMessage("Creating your personalized itinerary...");
      parserRef.current.reset();
      
      // Create AbortController for cancellation support
      abortControllerRef.current = new AbortController();

      let fullContent = "";

      try {
        // Import server action dynamically
        const { processStreamedContent } = await import("@/features/generateLLM/generateAction");

        // Start secure streaming generation with cancel support
        const streamingResult = await handleSecureStreaming(result.data, abortControllerRef.current.signal);

        // Check if streaming failed and fallback is needed
        if (streamingResult === null) {
          console.warn("⚠️ Streaming returned null, falling back to non-streaming generation");
          await handleFallbackGeneration(result.data);
          return;
        }

        fullContent = streamingResult;
        setLoadingMessage("Processing your itinerary...");
        setIsStreaming(false);

        // Process the complete content
        const request = {
          destination: result.data.destination,
          startDate: result.data.startDate,
          endDate: result.data.endDate,
          interests: result.data.interests,
          travelStyle: result.data.travelStyle,
          additionalNotes: result.data.additionalNotes,
        };

        const generatedItinerary = await processStreamedContent(fullContent, request);
        
        setLoadingMessage("Calculating driving routes...");

        // Generate directions
        let directions: any[] = [];
        let updatedItinerary = generatedItinerary;
        
        try {
          const { generateDirectionsWithTimes } = await import("@/features/directions/generator");
          const directionResult = await generateDirectionsWithTimes(generatedItinerary);
          directions = directionResult.directions;
          updatedItinerary = directionResult.updatedItinerary;
        } catch (error) {
          console.error("⚠️ Failed to generate directions:", error);
        }

        // Convert to editor data format
        const editorData = convertItineraryToEditorData(updatedItinerary, true);

        // Store form metadata in context
        setFormMetadata({
          destination: result.data.destination,
          startDate: new Date(result.data.startDate),
          endDate: new Date(result.data.endDate),
          interests: result.data.interests,
          travelStyle: result.data.travelStyle,
          additionalNotes: result.data.additionalNotes || undefined,
        });

        setEditorData(editorData);

        if (directions.length > 0) {
          setDirectionsData(directions);
        }

        setLoadingMessage("Saving to database and preparing editor...");

        // Wait for auto-save to complete and get the itinerary ID
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts && !state.currentItineraryId) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        if (state.currentItineraryId) {
          const { generateItinerarySlug } = await import("@/utils/itinerary");
          const title = updatedItinerary.title || "New Itinerary";
          const slug = generateItinerarySlug(title, state.currentItineraryId, editorData);
          
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('fresh-from-create', 'true');
            sessionStorage.setItem('fresh-from-create-timestamp', Date.now().toString());
            sessionStorage.setItem('fresh-itinerary-id', state.currentItineraryId);
          }
          
          router.push(`/editor/${slug}`);
          return;
        } else {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('fresh-from-create', 'true');
            sessionStorage.setItem('fresh-from-create-timestamp', Date.now().toString());
          }
          
          router.push("/editor");
          return;
        }
      } catch (streamingError) {
        console.error("Secure streaming generation failed:", streamingError);

        // Check if operation was cancelled
        if (streamingError instanceof Error && streamingError.message === "Operation was cancelled") {
          console.log("✅ Itinerary generation was cancelled by user");
          return; // Exit gracefully, UI already reset by handleCancel
        }

        // Check if it's a security-related error
        if (securityError) {
          let errorMessage = "Security error occurred. ";

          switch (securityError.type) {
            case "RATE_LIMITED":
              errorMessage += "You've exceeded the request limit. Please try again later.";
              break;
            case "CSRF_INVALID":
              errorMessage += "Security token expired. Please refresh the page and try again.";
              break;
            case "UNAUTHORIZED":
              errorMessage += "Please log in and try again.";
              break;
            default:
              errorMessage += securityError.message;
          }

          setErrors({ submit: errorMessage });
          setIsLoading(false);
          setIsStreaming(false);
          setLoadingMessage("");
          setStreamingLines([]);
          setStreamingFailedWarning(null);
          return;
        }

        // For other errors (not streaming failures), attempt fallback
        console.warn("⚠️ Unexpected error during streaming, attempting fallback to non-streaming generation");
        await handleFallbackGeneration(result.data);
        return;
      }
    } catch (error) {
      console.error("Error generating itinerary:", error);
      
      // Check for security errors first
      if (securityError) {
        setErrors({ submit: `Security error: ${securityError.message}` });
      } else {
        setErrors({ submit: "Failed to generate itinerary. Please try again." });
      }
      
      setIsLoading(false);
      setIsStreaming(false);
      setLoadingMessage("");
      setStreamingLines([]);
      setStreamingFailedWarning(null);
    }
  };

  // Get today's date for date input min values
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const renderStreamingLine = (line: PreviewLine, index: number) => {
    switch (line.type) {
      case "title":
        return (
          <div key={index} className="text-xl font-bold text-slate-800 mb-4">
            {line.cleanedContent}
          </div>
        );
      case "day":
        return (
          <div 
            key={index} 
            className="bg-slate-600 text-white px-4 py-2 rounded-lg mb-2 font-medium"
          >
            Day {line.metadata?.dayNumber} - {line.cleanedContent}
          </div>
        );
      case "place":
        return (
          <div 
            key={index} 
            className="border-2 border-slate-400 px-3 py-2 rounded-md mb-2 bg-white/80"
          >
            <span className="font-medium text-slate-700">
              {line.cleanedContent}
            </span>
            {line.metadata?.coordinates && (
              <span className="text-xs text-slate-500 ml-2">
                ({line.metadata.coordinates.lat.toFixed(5)}, {line.metadata.coordinates.lng.toFixed(5)})
              </span>
            )}
          </div>
        );
      case "paragraph":
        return (
          <div key={index} className="text-slate-600 mb-2 leading-relaxed">
            {line.cleanedContent}
          </div>
        );
      default:
        return (
          <div key={index} className="text-slate-500 mb-1">
            {line.cleanedContent}
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 relative">
        {/* Warning Notification - Fixed position top-right */}
        {streamingFailedWarning && (
          <div className="fixed top-4 right-4 z-50 max-w-sm bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-800 font-medium">Streaming Notice</p>
                <p className="text-sm text-amber-700 mt-1">{streamingFailedWarning}</p>
              </div>
              <button
                onClick={() => setStreamingFailedWarning(null)}
                className="ml-4 text-amber-600 hover:text-amber-800"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Streaming Content Background - positioned from top-left */}
        {isStreaming && streamingLines.length > 0 && (
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div
              ref={streamingContainerRef}
              className="h-full overflow-y-auto p-8 bg-black/5"
            >
              <div className="max-w-4xl space-y-1 opacity-70">
                {streamingLines.map((line, index) => renderStreamingLine(line, index))}
              </div>
            </div>
          </div>
        )}
        
        {/* Loading Overlay - removed backdrop-blur, replaced with partial transparency */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center bg-white/70">
          <div className="text-center bg-white/90 p-8 rounded-2xl shadow-lg border border-white/50">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <SparklesIcon className="h-10 w-10 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              {isStreaming ? "Generating Your Itinerary" : "Processing Your Itinerary"}
            </h2>
            <p className="text-lg text-slate-600 mb-8">{loadingMessage}</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              {isStreaming ? "Watch your itinerary come to life..." : "This may take a few moments..."}
            </p>
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
