// js/ucGate.js
console.error("ucGate.js loaded");

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

  // If they already continued before, do not block them again
  try {
    const dismissed = localStorage.getItem(KEY) === "1";
    if (dismissed) hideGate();
    else showGate();
  } catch {
    // If localStorage is blocked, default to showing the gate
    showGate();
  }

  // Wire the continue button
  const btn = document.getElementById("ucContinueBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch {}
      hideGate();
    });
  }
})();
