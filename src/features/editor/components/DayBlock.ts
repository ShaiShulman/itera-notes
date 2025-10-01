import type { DayBlockData } from "../types";
import { getDayColor } from "../../map/utils/colors";
import { IconPaths } from "@/assets/icons/iconLoader";
import { TRANSPORT_MODE_OPTIONS, TransportMode } from "@/types/transport";

/**
 * Get transport icon path for a given mode
 */
function getTransportIconPath(mode: string = "driving"): string {
  switch (mode.toLowerCase()) {
    case "transit":
      return IconPaths.TRANSIT;
    case "walking":
      return IconPaths.WALKING;
    case "driving":
    default:
      return IconPaths.DRIVING;
  }
}

// Global utility function to trigger transport mode updates
function triggerTransportModeUpdate() {
  if (typeof window !== "undefined") {
    console.log("🚗 Triggering global transport mode update");
    window.dispatchEvent(new CustomEvent("editor:updateTransportModes"));
  }
}

export default class DayBlock {
  private data: DayBlockData;
  private wrapper: HTMLElement | null = null;
  private isExpanded: boolean = false;
  private actualDayNumber: number = 1; // Auto-calculated day number
  private orderObserver: MutationObserver | null = null; // Store observer for cleanup

  // Editing state management
  private originalTitle: string = "";
  private isCurrentlyEditingTitle: boolean = false;
  private currentTitleValue: string = "";

  // Debounced auto-save for title changes
  private titleSaveTimeout: NodeJS.Timeout | null = null;
  private readonly TITLE_SAVE_DELAY = 1000; // 1 second delay

  constructor({ data }: { data?: DayBlockData }) {
    this.data = {
      dayNumber: data?.dayNumber || 1, // This will be overridden by auto-calculation
      date: data?.date || "",
      title: data?.title || "",
      region: data?.region || "",
      transportMode: data?.transportMode || "driving",
    };
  }

  private getDayColor(): string {
    // Use auto-calculated day number - 1 as index since dayNumber starts from 1
    return getDayColor(this.actualDayNumber - 1);
  }

  private calculateDayNumber(): number {
    // Find this block's position among all day blocks in the editor
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) return 1;

    const allDayBlocks = editorElement.querySelectorAll(".day-block");
    let dayIndex = 1;

    for (let i = 0; i < allDayBlocks.length; i++) {
      if (allDayBlocks[i] === this.wrapper) {
        dayIndex = i + 1;
        break;
      }
    }

    console.log(`DayBlock: Calculated day number ${dayIndex} for this block`);
    return dayIndex;
  }

  private updateDayNumber() {
    const newDayNumber = this.calculateDayNumber();
    if (newDayNumber !== this.actualDayNumber) {
      console.log(
        `DayBlock: Updating day number from ${this.actualDayNumber} to ${newDayNumber}`
      );
      this.actualDayNumber = newDayNumber;
      this.data.dayNumber = newDayNumber;

      // Re-render to show updated number
      if (this.wrapper) {
        // Ensure transport mode attribute is preserved
        this.wrapper.setAttribute('data-transport-mode', this.data.transportMode || "driving");

        if (this.isExpanded) {
          this.renderExpanded();
        } else {
          this.renderCollapsed();
        }
      }
    }
  }

  render() {
    const dayColor = this.getDayColor();

    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("day-block");
    this.wrapper.setAttribute('data-transport-mode', this.data.transportMode || "driving");
    this.wrapper.style.cssText = `
      border: 2px solid ${dayColor};
      border-radius: 12px;
      margin: 8px 0;
      background: linear-gradient(135deg, ${dayColor}15 0%, ${dayColor}25 100%);
      position: relative;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Calculate initial day number
    setTimeout(() => {
      this.updateDayNumber();
    }, 100);

    // Set up observer to watch for changes in day block order
    this.setupOrderObserver();

    this.renderCollapsed();

    // Add click handler for expand/collapse
    this.wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Add hover event listeners for map integration
    this.wrapper.addEventListener("mouseenter", (e) => {
      e.stopPropagation();
      this.handleMouseEnter();
    });

    this.wrapper.addEventListener("mouseleave", (e) => {
      e.stopPropagation();
      this.handleMouseLeave();
    });

    return this.wrapper;
  }

  private setupOrderObserver() {
    // Watch for changes in the editor structure that might affect day numbering
    const observer = new MutationObserver(() => {
      // Debounce the update to avoid excessive recalculations
      setTimeout(() => {
        this.updateDayNumber();
      }, 50);
    });

    // Observe the parent editor for structural changes
    setTimeout(() => {
      const editorElement = this.wrapper?.closest(".codex-editor");
      if (editorElement) {
        observer.observe(editorElement, {
          childList: true,
          subtree: true,
        });

        // Store observer for cleanup
        this.orderObserver = observer;
      }
    }, 100);
  }

  // Editing state management methods
  private startEditingTitle(): void {
    this.originalTitle = this.data.title || "";
    this.currentTitleValue = this.data.title || "";
    this.isCurrentlyEditingTitle = true;
    console.log(`DayBlock: Started editing title "${this.originalTitle}"`);
  }

  private commitTitleEdit(): void {
    if (this.isCurrentlyEditingTitle) {
      this.data.title = this.currentTitleValue;
      this.isCurrentlyEditingTitle = false;
      console.log(`DayBlock: Committed title edit "${this.currentTitleValue}"`);
    }
  }

  private revertTitleEdit(): void {
    if (this.isCurrentlyEditingTitle) {
      this.currentTitleValue = this.originalTitle;
      this.data.title = this.originalTitle;
      this.isCurrentlyEditingTitle = false;
      console.log(`DayBlock: Reverted title edit to "${this.originalTitle}"`);
    }
  }

  private renderCollapsed() {
    if (!this.wrapper) return;

    this.wrapper.innerHTML = "";
    this.wrapper.style.padding = "12px 16px";

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const leftContent = document.createElement("div");
    leftContent.style.cssText = "display: flex; align-items: center;";

    const dayColor = this.getDayColor();

    // Day badge
    const badge = document.createElement("div");
    badge.style.cssText = `
      background: ${dayColor};
      color: white;
      padding: 4px 10px;
      border-radius: 16px;
      font-weight: bold;
      font-size: 12px;
      margin-right: 8px;
    `;
    badge.textContent = `Day ${this.actualDayNumber}`;

    // Color swatch
    const colorSwatch = document.createElement("div");
    colorSwatch.style.cssText = `
      width: 16px;
      height: 16px;
      background: ${dayColor};
      border-radius: 50%;
      margin-right: 8px;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    `;

    // Title display
    const titleDisplay = document.createElement("span");
    titleDisplay.style.cssText = `
      color: #1e40af;
      font-weight: 500;
      font-size: 14px;
    `;
    titleDisplay.textContent = this.data.title || "Click to add title...";

    // Right side controls
    const rightControls = document.createElement("div");
    rightControls.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Transport mode display
    const transportDisplay = document.createElement("div");
    transportDisplay.style.cssText = `
      display: flex;
      align-items: center;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-right: 4px;
    `;

    const transportIconPath = getTransportIconPath(this.data.transportMode || "driving");
    transportDisplay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px;">
        <img src="${transportIconPath}" alt="${this.data.transportMode || "driving"} icon" width="18" height="18" style="display: inline;">
        <span style="font-size: 11px; color: #374151; font-weight: 500;">
          ${(this.data.transportMode || "driving").charAt(0).toUpperCase() + (this.data.transportMode || "driving").slice(1)}
        </span>
      </div>
    `;

    transportDisplay.addEventListener("mouseenter", () => {
      transportDisplay.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    });
    transportDisplay.addEventListener("mouseleave", () => {
      transportDisplay.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    });
    transportDisplay.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showTransportSelector();
    });

    // Add Place button
    const addPlaceBtn = document.createElement("button");
    addPlaceBtn.style.cssText = `
      background: #10b981;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.2s;
    `;
    addPlaceBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
      Place
    `;
    addPlaceBtn.addEventListener("mouseenter", () => {
      addPlaceBtn.style.backgroundColor = "#059669";
    });
    addPlaceBtn.addEventListener("mouseleave", () => {
      addPlaceBtn.style.backgroundColor = "#10b981";
    });
    addPlaceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.addBlockAfterDay("place");
    });

    // Add Text button
    const addTextBtn = document.createElement("button");
    addTextBtn.style.cssText = `
      background: #6b7280;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.2s;
    `;
    addTextBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" fill="none"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
      </svg>
      Text
    `;
    addTextBtn.addEventListener("mouseenter", () => {
      addTextBtn.style.backgroundColor = "#4b5563";
    });
    addTextBtn.addEventListener("mouseleave", () => {
      addTextBtn.style.backgroundColor = "#6b7280";
    });
    addTextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.addBlockAfterDay("paragraph");
    });

    // Add Hotel button
    const addHotelBtn = document.createElement("button");
    addHotelBtn.style.cssText = `
      background: #8b5cf6;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.2s;
    `;
    addHotelBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M2 12h4l2-2h2l2 2h4v5H2v-5z" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M12 7v5" stroke="currentColor" stroke-width="2"/>
        <path d="M8 17h8" stroke="currentColor" stroke-width="2"/>
        <path d="M3 7v10" stroke="currentColor" stroke-width="2"/>
        <path d="M21 7v10" stroke="currentColor" stroke-width="2"/>
        <path d="M4 4h16v3H4z" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
      Hotel
    `;
    addHotelBtn.addEventListener("mouseenter", () => {
      addHotelBtn.style.backgroundColor = "#7c3aed";
    });
    addHotelBtn.addEventListener("mouseleave", () => {
      addHotelBtn.style.backgroundColor = "#8b5cf6";
    });
    addHotelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.addBlockAfterDay("hotel");
    });

    // Expand arrow
    const expandArrow = document.createElement("div");
    expandArrow.style.cssText = `
      color: #3b82f6;
      font-size: 18px;
      transform: rotate(${this.isExpanded ? "180deg" : "0deg"});
      transition: transform 0.2s ease;
      margin-left: 8px;
    `;
    expandArrow.innerHTML = "▼";

    leftContent.appendChild(badge);
    leftContent.appendChild(colorSwatch);
    leftContent.appendChild(titleDisplay);

    rightControls.appendChild(transportDisplay);
    rightControls.appendChild(addPlaceBtn);
    rightControls.appendChild(addHotelBtn);
    rightControls.appendChild(addTextBtn);
    rightControls.appendChild(expandArrow);

    header.appendChild(leftContent);
    header.appendChild(rightControls);
    this.wrapper.appendChild(header);
  }

  private renderExpanded() {
    if (!this.wrapper) return;

    this.wrapper.innerHTML = "";
    this.wrapper.style.padding = "16px 20px";

    // Header with collapse button
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      cursor: pointer;
    `;

    const leftContent = document.createElement("div");
    leftContent.style.cssText = "display: flex; align-items: center;";

    const dayColor = this.getDayColor();

    // Day badge
    const badge = document.createElement("div");
    badge.style.cssText = `
      background: ${dayColor};
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      margin-right: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    badge.textContent = `Day ${this.actualDayNumber}`;

    // Color swatch
    const colorSwatch = document.createElement("div");
    colorSwatch.style.cssText = `
      width: 18px;
      height: 18px;
      background: ${dayColor};
      border-radius: 50%;
      margin-right: 8px;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    `;

    // Title display
    const titleDisplay = document.createElement("span");
    titleDisplay.style.cssText = `
      color: #1e40af;
      font-weight: 600;
      font-size: 16px;
    `;
    titleDisplay.textContent = this.data.title || "Click to add title...";

    // Collapse arrow
    const collapseArrow = document.createElement("div");
    collapseArrow.style.cssText = `
      color: ${dayColor};
      font-size: 18px;
      transform: rotate(180deg);
      transition: transform 0.2s ease;
    `;
    collapseArrow.innerHTML = "▼";

    leftContent.appendChild(badge);
    leftContent.appendChild(colorSwatch);
    leftContent.appendChild(titleDisplay);
    header.appendChild(leftContent);
    header.appendChild(collapseArrow);

    header.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Start editing mode for title
    this.startEditingTitle();

    // Title input
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Enter day title...";
    titleInput.value = this.currentTitleValue;
    titleInput.style.cssText = `
      width: 100%;
      border: 1px solid #93c5fd;
      background: white;
      font-size: 16px;
      font-weight: 500;
      color: #1e40af;
      margin-bottom: 16px;
      outline: none;
      padding: 10px 12px;
      border-radius: 6px;
    `;
    titleInput.addEventListener("input", (e) => {
      this.currentTitleValue = (e.target as HTMLInputElement).value;
      this.data.title = this.currentTitleValue; // Update immediately

      // Trigger EditorJS onChange to save to database
      this.triggerEditorChange();
    });

    titleInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Add Enter and Escape key handlers for title input
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        // Commit the title edit
        this.commitTitleEdit();

        // Update the collapsed display
        titleDisplay.textContent = this.data.title || "Click to add title...";

        // Save and collapse
        this.saveAndCollapse();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();

        // Revert changes
        this.revertTitleEdit();

        // Update input value to reverted title
        titleInput.value = this.currentTitleValue;

        // Just collapse without saving
        this.isExpanded = false;
        this.renderCollapsed();
      }
    });

    // Handle blur event for title input (focus loss to other elements)
    titleInput.addEventListener("blur", () => {
      // Small delay to ensure we're not just moving to another field in the same block
      setTimeout(() => {
        if (this.isCurrentlyEditingTitle) {
          console.log("DayBlock: Title input focus lost, reverting edit");

          // Revert changes
          this.revertTitleEdit();

          // Update input value to reverted title
          titleInput.value = this.currentTitleValue;

          // Just collapse without saving
          this.isExpanded = false;
          this.renderCollapsed();
        }
      }, 200);
    });

    // Date input
    const dateLabel = document.createElement("label");
    dateLabel.style.cssText = `
      display: block;
      color: #1e40af;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    `;
    dateLabel.textContent = "Date:";

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = this.data.date || "";
    dateInput.style.cssText = `
      border: 1px solid #93c5fd;
      border-radius: 6px;
      padding: 8px 12px;
      background: white;
      color: #1e40af;
      font-size: 14px;
      margin-bottom: 16px;
    `;
    dateInput.addEventListener("change", (e) => {
      this.data.date = (e.target as HTMLInputElement).value;
    });

    dateInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Add Enter key handler for date input
    dateInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        this.saveAndCollapse();
      }
    });

    // Transport mode selector
    const transportLabel = document.createElement("label");
    transportLabel.style.cssText = `
      display: block;
      color: #1e40af;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    `;
    transportLabel.textContent = "Transport Mode:";

    const transportSelector = document.createElement("div");
    transportSelector.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    `;

    const transportModes = TRANSPORT_MODE_OPTIONS;

    transportModes.forEach(mode => {
      const transportOption = document.createElement("button");
      transportOption.type = "button";
      const isSelected = this.data.transportMode === mode.value;

      transportOption.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 16px;
        border: 2px solid ${isSelected ? dayColor : "#e5e7eb"};
        border-radius: 8px;
        background: ${isSelected ? `${dayColor}15` : "white"};
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1;
        gap: 4px;
      `;

      const transportIconPath = getTransportIconPath(mode.value);
      transportOption.innerHTML = `
        <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <img src="${transportIconPath}" alt="${mode.value} icon" width="20" height="20" style="display: inline;">
        </div>
        <span style="font-size: 12px; font-weight: 500; color: ${isSelected ? dayColor : "#6b7280"};">
          ${mode.label}
        </span>
      `;

      transportOption.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setTransportMode(mode.value);
        this.renderExpanded(); // Re-render to update selection
      });

      transportOption.addEventListener("mouseenter", () => {
        if (!isSelected) {
          transportOption.style.borderColor = dayColor;
          transportOption.style.background = `${dayColor}10`;
        }
      });

      transportOption.addEventListener("mouseleave", () => {
        if (!isSelected) {
          transportOption.style.borderColor = "#e5e7eb";
          transportOption.style.background = "white";
        }
      });

      transportSelector.appendChild(transportOption);
    });


    // Save button container (positioned bottom right)
    const saveButtonContainer = document.createElement("div");
    saveButtonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    `;

    const saveButton = document.createElement("button");
    saveButton.style.cssText = `
      background: ${dayColor};
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    saveButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
      Save
    `;

    saveButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.saveAndCollapse();
    });

    saveButton.addEventListener("mouseenter", () => {
      saveButton.style.transform = "scale(1.05)";
      saveButton.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
    });

    saveButton.addEventListener("mouseleave", () => {
      saveButton.style.transform = "scale(1)";
      saveButton.style.boxShadow = "none";
    });

    saveButtonContainer.appendChild(saveButton);

    this.wrapper.appendChild(header);
    this.wrapper.appendChild(titleInput);
    this.wrapper.appendChild(dateLabel);
    this.wrapper.appendChild(dateInput);
    this.wrapper.appendChild(transportLabel);
    this.wrapper.appendChild(transportSelector);
    this.wrapper.appendChild(saveButtonContainer);

    // Focus title input after rendering
    setTimeout(() => titleInput.focus(), 100);
  }

  private saveAndCollapse() {
    // Save the current state
    console.log(`DayBlock: Saving day ${this.actualDayNumber} and collapsing`);

    // Collapse the block
    this.isExpanded = false;
    this.renderCollapsed();

    // Trigger a content change event to save the editor state
    if (this.wrapper) {
      const changeEvent = new Event("input", { bubbles: true });
      this.wrapper.dispatchEvent(changeEvent);
    }
  }

  private triggerEditorChange() {
    // Clear any existing timeout
    if (this.titleSaveTimeout) {
      clearTimeout(this.titleSaveTimeout);
      this.titleSaveTimeout = null;
    }

    // Set up debounced save - only save after user stops typing for TITLE_SAVE_DELAY
    this.titleSaveTimeout = setTimeout(() => {
      if (this.wrapper) {
        // First try to find the EditorJS block container
        const editorBlock = this.wrapper.closest('.ce-block');
        if (editorBlock) {
          // Dispatch both input and change events to ensure EditorJS detects the change
          const inputEvent = new Event("input", { bubbles: true });
          const changeEvent = new Event("change", { bubbles: true });

          editorBlock.dispatchEvent(inputEvent);
          editorBlock.dispatchEvent(changeEvent);

          console.log(`DayBlock: Triggered EditorJS change events for title update (debounced)`);
        } else {
          // Fallback: dispatch on the wrapper itself
          const changeEvent = new Event("input", { bubbles: true });
          this.wrapper.dispatchEvent(changeEvent);

          console.log(`DayBlock: Triggered fallback change event for title update (debounced)`);
        }
      }

      this.titleSaveTimeout = null;
    }, this.TITLE_SAVE_DELAY);

    console.log(`DayBlock: Scheduled debounced save for title change in ${this.TITLE_SAVE_DELAY}ms`);
  }

  private toggle() {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.renderExpanded();
    } else {
      this.renderCollapsed();
    }
  }

  private setTransportMode(mode: TransportMode) {
    this.data.transportMode = mode;
    console.log(`DayBlock: Set transport mode to ${mode} for Day ${this.actualDayNumber}`);

    // Update the data-transport-mode attribute for place blocks to read
    if (this.wrapper) {
      this.wrapper.setAttribute('data-transport-mode', mode);
    }

    // Clear existing driving times for places in this day since they're no longer valid
    this.clearDrivingTimesForDay();

    // Trigger editor change event to save the update
    this.triggerEditorChange();

    // Re-render collapsed view to update the transport display
    if (!this.isExpanded) {
      this.renderCollapsed();
    }

    // Notify all place blocks to update their transport icons and clear invalid times
    triggerTransportModeUpdate();
  }

  private clearDrivingTimesForDay() {
    // Find all place blocks in this day and clear their driving times
    const editorElement = this.wrapper?.closest('.codex-editor');
    if (!editorElement) return;

    const allBlocks = editorElement.querySelectorAll('.ce-block');
    let foundThisDay = false;
    let currentDay = 0;

    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];

      // Check if this block contains a day block
      if (block.querySelector('.day-block')) {
        currentDay++;

        // Check if this is our day block
        if (block.contains(this.wrapper)) {
          foundThisDay = true;
        }
      } else if (foundThisDay && currentDay === this.actualDayNumber) {
        // Check if this is a place or hotel block in our day
        const placeBlock = block.querySelector('.place-block, .hotel-block');
        if (placeBlock) {
          // Dispatch event to clear driving times for this place
          const clearEvent = new CustomEvent('place:clearDrivingTimes', {
            bubbles: true
          });
          placeBlock.dispatchEvent(clearEvent);
        }
      } else if (foundThisDay && currentDay > this.actualDayNumber) {
        // We've moved past this day, stop searching
        break;
      }
    }

    console.log(`🚗 DayBlock: Cleared driving times for Day ${this.actualDayNumber} places`);
  }

  private showTransportSelector() {
    // Simply expand to show the transport options
    if (!this.isExpanded) {
      this.isExpanded = true;
      this.renderExpanded();
    }
  }

  save(blockContent: HTMLElement) {
    const titleInput = blockContent.querySelector(
      'input[placeholder="Day title..."]'
    ) as HTMLInputElement;
    const dateInput = blockContent.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;

    return {
      dayNumber: this.actualDayNumber, // Use auto-calculated number
      title: titleInput?.value || this.data.title || "",
      date: dateInput?.value || this.data.date || "",
      region: this.data.region || "", // Keep existing region data if any
      transportMode: this.data.transportMode || "driving",
    };
  }

  // Mouse hover handlers for map integration
  private handleMouseEnter() {
    // Only emit hover events if not in editing mode
    if (this.isCurrentlyEditingTitle) {
      return;
    }

    console.log(`DayBlock: Mouse entered Day ${this.actualDayNumber}`);
    this.emitDayHoverEvent(true);
  }

  private handleMouseLeave() {
    // Only emit hover events if not in editing mode
    if (this.isCurrentlyEditingTitle) {
      return;
    }

    console.log(`DayBlock: Mouse left Day ${this.actualDayNumber}`);
    this.emitDayHoverEvent(false);
  }

  // Emit day hover events for map integration
  private emitDayHoverEvent(isHovering: boolean) {
    if (isHovering) {
      // Find all places in this day for the hover event
      const dayPlaces = this.findPlacesInDay();

      // Emit editor:dayHover event
      const event = new CustomEvent("editor:dayHover", {
        detail: {
          dayNumber: this.actualDayNumber,
          places: dayPlaces,
        },
        bubbles: true,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(event);
        console.log(`📡 editor:dayHover event emitted:`, {
          dayNumber: this.actualDayNumber,
          placeCount: dayPlaces.length,
        });
      }
    } else {
      // Emit editor:hoverEnd event
      const event = new CustomEvent("editor:hoverEnd", {
        detail: {},
        bubbles: true,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(event);
        console.log(`📡 editor:hoverEnd event emitted from day`);
      }
    }
  }

  // Helper method to find all places in this day
  private findPlacesInDay(): any[] {
    if (!this.wrapper) return [];

    const editorElement = this.wrapper.closest(".codex-editor");
    if (!editorElement) return [];

    const allBlocks = editorElement.querySelectorAll(".ce-block");
    const places: any[] = [];
    let currentDay = 0;
    let foundThisDay = false;

    // Find all place and hotel blocks that belong to this day
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];

      // Check if this block contains a day block
      if (block.querySelector(".day-block")) {
        currentDay++;

        // Check if this is our day block
        if (block.contains(this.wrapper)) {
          foundThisDay = true;
        }
      } else if (foundThisDay && currentDay === this.actualDayNumber) {
        // Check if this is a place or hotel block
        const placeBlock = block.querySelector(".place-block, .hotel-block");
        if (placeBlock) {
          // Extract place data from the DOM
          const uid = placeBlock.getAttribute("data-uid");
          const lat = placeBlock.getAttribute("data-lat");
          const lng = placeBlock.getAttribute("data-lng");
          const nameElement = placeBlock.querySelector("[data-place-name]") ||
                             placeBlock.querySelector(".place-name") ||
                             placeBlock.textContent;

          if (uid && lat && lng) {
            places.push({
              uid: uid,
              name: typeof nameElement === "string" ? nameElement : (nameElement?.textContent || "Unknown Place"),
              lat: parseFloat(lat),
              lng: parseFloat(lng),
              __type: placeBlock.classList.contains("hotel-block") ? "hotel" : "place",
            });
          }
        }
      } else if (foundThisDay && currentDay > this.actualDayNumber) {
        // We've moved past this day, stop searching
        break;
      }
    }

    console.log(`DayBlock: Found ${places.length} places for Day ${this.actualDayNumber}:`, places.map(p => ({
      uid: p.uid,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      hasCoords: !!(p.lat && p.lng)
    })));
    return places;
  }

  // Add cleanup method for the observer and timers
  destroy() {
    if (this.orderObserver) {
      this.orderObserver.disconnect();
      this.orderObserver = null;
    }

    // Clean up title save timeout
    if (this.titleSaveTimeout) {
      clearTimeout(this.titleSaveTimeout);
      this.titleSaveTimeout = null;
    }
  }

  private addBlockAfterDay(blockType: "place" | "paragraph" | "hotel") {
    console.log(
      `DayBlock: Adding ${blockType} after day ${this.actualDayNumber}`
    );

    // Find the Editor.js instance
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) {
      console.error("DayBlock: Could not find editor element");
      return;
    }

    // Get the global editor instance - this is a bit tricky since Editor.js doesn't expose it directly
    // We'll use a custom event to communicate with the parent component
    const customEvent = new CustomEvent("dayblock:addBlock", {
      detail: {
        dayBlockElement: this.wrapper,
        blockType: blockType,
        dayNumber: this.actualDayNumber,
      },
      bubbles: true,
    });

    this.wrapper?.dispatchEvent(customEvent);
  }

  static get sanitize() {
    return {
      dayNumber: false,
      date: false,
      title: false,
      region: false,
    };
  }
}