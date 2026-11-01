# PipelineShield — Final Comprehensive Viva Presentation

This directory contains the standalone HTML/CSS/JavaScript slide presentation for the **PipelineShield Final Comprehensive Viva** (scheduled for Monday, 2 November 2026).

---

## 1. How to Open Locally

The presentation has **zero external frameworks, compilers, or runtime dependencies**. It runs directly in any modern browser.

### Option A: Direct Local Open
Open `ppt/index.html` in your default browser:

**Windows PowerShell:**
```powershell
Start-Process "c:\Users\Amruth\Desktop\PipelineShield\ppt\index.html"
```
Or simply double-click `ppt/index.html` in File Explorer.

### Option B: Local Static Server (Optional)
If running an HTTP server:
```powershell
npx serve ppt
# or python -m http.server 8000 (from within the ppt directory)
```

---

## 2. Controls & Keyboard Shortcuts

| Key / Action | Action | Description |
|---|---|---|
| <kbd>→</kbd> / <kbd>Space</kbd> / <kbd>PageDown</kbd> | **Next Slide** | Advances to the next slide with smooth transition. |
| <kbd>←</kbd> / <kbd>PageUp</kbd> | **Previous Slide** | Returns to the previous slide. |
| <kbd>Home</kbd> | **First Slide** | Jumps to Slide 1 immediately. |
| <kbd>End</kbd> | **Last Slide** | Jumps to the final slide. |
| <kbd>F</kbd> | **Fullscreen** | Toggles browser fullscreen presentation mode. |
| <kbd>O</kbd> / <kbd>Esc</kbd> | **Slide Overview** | Toggles the slide thumbnail/list drawer. |
| **Touch Swipe Left/Right** | **Next / Prev** | On tablets or mobile touch devices. |

---

## 3. Architecture & Design Rules

* **Aspect Ratio**: Standard 16:9 wide presentation canvas (`aspect-ratio: 16 / 9`) with auto-scaling to fit any display resolution without stretching or distortion.
* **Theme**: Authentic to PipelineShield’s engineering editorial design:
  * Dark Slate backdrop (`#0F172A`) for stage immersion.
  * Crisp white slide cards (`#FFFFFF`) with generous internal spacing.
  * Deep Teal accent (`#0D9488` / `#0F766E`) for category badges, highlights, and progress bar.
  * Serif headings (`Georgia`) paired with clean sans-serif body typography and Courier monospace data indicators.
* **Input Isolation**: Keyboard shortcuts are automatically suspended when an input field or editable element is focused.
* **URL Sync**: Current slide index synchronizes quietly with the URL hash (`#1`, `#2`, etc.), preserving place on page reload.

---

## 4. Current Status

* **Slide 1**: Title and Team slide authored and active.
* **Slide 2**: Introduction slide authored ("What is PipelineShield?").
* **Next Step**: Review Slide 2, then proceed to author Slide 3 (Why we chose this project / Problem statement).

