// js/ucGate.js
(function () {
  const KEY = "aob_uc_gate_dismissed_v1";

  function hideGate() {
    const gate = document.getElementById("ucGate");
    if (gate) gate.style.display = "none";
  }

  function showGate() {
    const gate = document.getElementById("ucGate");
    if (gate) gate.style.display = "flex";
  }

  function init() {
    try {
      const dismissed = localStorage.getItem(KEY) === "1";
      if (dismissed) hideGate();
      else showGate();
    } catch {
      showGate();
    }

    const btn = document.getElementById("ucContinueBtn");
    if (!btn) {
      console.error("ucGate: Continue button not found");
      return;
    }

    btn.addEventListener("click", () => {
      try {
        localStorage.setItem(KEY, "1");
      } catch (e) {
        // ignore storage failures (e.g., privacy mode)
        console.debug("ucGate: localStorage set failed", e);
      }
      hideGate();
    });
  }

  // Ensure DOM exists before wiring
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

