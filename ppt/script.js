/**
 * PipelineShield Viva Presentation Shell Script
 * Zero-dependency, accessible vanilla JavaScript controller
 */

(function () {
  "use strict";

  // State
  let currentSlideIndex = 0;
  let slides = [];
  let isOverviewOpen = false;

  // DOM Elements
  const slideDeck = document.getElementById("slideDeck");
  const slideCounter = document.getElementById("slideCounter");
  const progressBar = document.getElementById("progressBar");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnOverview = document.getElementById("btnOverview");
  const btnCloseOverview = document.getElementById("btnCloseOverview");
  const overviewModal = document.getElementById("overviewModal");
  const overviewGrid = document.getElementById("overviewGrid");
  const appShell = document.getElementById("appShell");

  /**
   * Initialize Presentation
   */
  function init() {
    slides = Array.from(document.querySelectorAll(".slide"));
    if (slides.length === 0) return;

    // Check URL hash for initial slide (e.g. #3 or #slide-3)
    const initialSlide = parseHash();
    if (initialSlide >= 0 && initialSlide < slides.length) {
      currentSlideIndex = initialSlide;
    }

    renderOverviewGrid();
    updateUI();
    bindEvents();
  }

  /**
   * Parse slide index from window.location.hash
   */
  function parseHash() {
    const hash = window.location.hash.replace("#", "").trim();
    if (!hash) return -1;
    const num = parseInt(hash.replace("slide-", ""), 10);
    return isNaN(num) ? -1 : num - 1;
  }

  /**
   * Update Slide View and Chrome Indicators
   */
  function updateUI() {
    slides.forEach((slide, index) => {
      const isActive = index === currentSlideIndex;
      slide.classList.toggle("active", isActive);
      slide.setAttribute("aria-hidden", !isActive);
      if (isActive) {
        slide.scrollTop = 0; // Reset scroll on view change
      }
    });

    // Update Counter
    if (slideCounter) {
      slideCounter.textContent = `Slide ${currentSlideIndex + 1} / ${slides.length}`;
    }

    // Update Progress Bar
    if (progressBar) {
      const progressPercent = slides.length <= 1 
        ? 100 
        : (currentSlideIndex / (slides.length - 1)) * 100;
      progressBar.style.width = `${progressPercent}%`;
    }

    // Update Button Disabled States
    if (btnPrev) {
      btnPrev.disabled = currentSlideIndex === 0;
    }
    if (btnNext) {
      btnNext.disabled = currentSlideIndex === slides.length - 1;
    }

    // Update Overview Active Highlight
    const overviewItems = overviewGrid.querySelectorAll(".overview-item");
    overviewItems.forEach((item, index) => {
      item.classList.toggle("active", index === currentSlideIndex);
    });

    // Sync URL Hash quietly
    if (window.location.hash !== `#${currentSlideIndex + 1}`) {
      history.replaceState(null, "", `#${currentSlideIndex + 1}`);
    }
  }

  /**
   * Navigate to Specific Slide
   */
  function goToSlide(index) {
    if (index < 0 || index >= slides.length || index === currentSlideIndex) return;
    currentSlideIndex = index;
    updateUI();
  }

  function nextSlide() {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }

  /**
   * Fullscreen Controller
   */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Fullscreen request error:", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  /**
   * Overview Modal Controller
   */
  function toggleOverview(open) {
    isOverviewOpen = typeof open === "boolean" ? open : !isOverviewOpen;
    overviewModal.classList.toggle("open", isOverviewOpen);
    if (isOverviewOpen) {
      overviewModal.focus();
    }
  }

  function renderOverviewGrid() {
    if (!overviewGrid) return;
    overviewGrid.innerHTML = "";

    slides.forEach((slide, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "overview-item" + (index === currentSlideIndex ? " active" : "");
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `Slide ${index + 1}: ${slide.dataset.title || `Slide ${index + 1}`}`);

      const num = document.createElement("div");
      num.className = "overview-item-num";
      num.textContent = `SLIDE ${String(index + 1).padStart(2, "0")}`;

      const title = document.createElement("div");
      title.className = "overview-item-title";
      title.textContent = slide.dataset.title || `Slide ${index + 1}`;

      card.appendChild(num);
      card.appendChild(title);

      card.addEventListener("click", () => {
        goToSlide(index);
        toggleOverview(false);
      });

      overviewGrid.appendChild(card);
    });
  }

  /**
   * Keyboard & Input Event Bindings
   */
  function bindEvents() {
    // Navigation Buttons
    if (btnPrev) btnPrev.addEventListener("click", prevSlide);
    if (btnNext) btnNext.addEventListener("click", nextSlide);
    if (btnFullscreen) btnFullscreen.addEventListener("click", toggleFullscreen);
    if (btnOverview) btnOverview.addEventListener("click", () => toggleOverview(true));
    if (btnCloseOverview) btnCloseOverview.addEventListener("click", () => toggleOverview(false));

    // Close overview when clicking backdrop
    if (overviewModal) {
      overviewModal.addEventListener("click", (e) => {
        if (e.target === overviewModal) {
          toggleOverview(false);
        }
      });
    }

    // Keyboard Navigation Listener
    document.addEventListener("keydown", (e) => {
      // Guard: Do not intercept typing in inputs or textareas
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ": // Spacebar
          if (!isOverviewOpen) {
            e.preventDefault();
            nextSlide();
          }
          break;

        case "ArrowLeft":
        case "PageUp":
          if (!isOverviewOpen) {
            e.preventDefault();
            prevSlide();
          }
          break;

        case "Home":
          if (!isOverviewOpen) {
            e.preventDefault();
            goToSlide(0);
          }
          break;

        case "End":
          if (!isOverviewOpen) {
            e.preventDefault();
            goToSlide(slides.length - 1);
          }
          break;

        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;

        case "o":
        case "O":
          e.preventDefault();
          toggleOverview();
          break;

        case "Escape":
          if (isOverviewOpen) {
            e.preventDefault();
            toggleOverview(false);
          }
          break;

        default:
          break;
      }
    });

    // Touch Swipe Gesture Listener (for tablets and touchscreens)
    let touchStartX = 0;
    let touchStartY = 0;

    appShell.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    appShell.addEventListener("touchend", (e) => {
      if (!touchStartX || !touchStartY || isOverviewOpen) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      // Only trigger if horizontal swipe is dominant and exceeds 50px
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          nextSlide(); // Swipe left -> Next
        } else {
          prevSlide(); // Swipe right -> Prev
        }
      }

      touchStartX = 0;
      touchStartY = 0;
    }, { passive: true });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

