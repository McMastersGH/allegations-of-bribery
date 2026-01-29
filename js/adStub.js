// js/adStub.js
// Simple dev stub that fills known ad-slot IDs with placeholder content.
(function () {
  const slots = [
    { id: 'ad-slot', text: 'Header sponsorship (dev stub)' },
    { id: 'ad-slot-sidebar', text: 'Sidebar sponsorship (dev stub)' },
    { id: 'ad-slot-post', text: 'Post sponsorship (dev stub)' }
  ];

  function fillSlot(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('ad-stub');
    // Custom temp promotion for header slot: link to a friend's site
    if (id === 'ad-slot') {
      // Prefer a local-hosted copy of the sponsor's header video when available.
      // The whole area is clickable and opens the sponsor in a new tab; a visible "Ad" badge is overlaid.
      el.innerHTML = `
        <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.04);background:#071017;height:180px;">
          <video autoplay muted loop playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;display:block;">
            <source src="assets/sponsor/kim-header.mp4" type="video/mp4">
            Sorry, your browser doesn't support embedded video.
          </video>
          <a href="https://kimtampark.com/" target="_blank" rel="noopener noreferrer" style="position:absolute;inset:0;z-index:20;display:block;background:transparent;border:0;padding:0;margin:0;">&nbsp;</a>
          <div style="position:absolute;top:8px;right:8px;display:flex;gap:8px;align-items:center;z-index:30;">
            <span style="background:rgba(0,0,0,0.6);color:#cbd5e1;padding:4px 8px;border-radius:999px;font-size:11px;">Ad</span>
          </div>
        </div>
        <noscript style="display:block;text-align:center;padding:8px;">
          <a href="https://kimtampark.com/" target="_blank" rel="noopener noreferrer">
            <img src="https://kimtampark.com/wp-content/uploads/revslider/video-media/3_58.jpeg" alt="Sponsor" style="width:100%;height:auto;border-radius:6px;" />
          </a>
        </noscript>
      `;

      return;
    }

    // Default stub content for other slots
    el.innerHTML = `
      <div style="padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div style="font-weight:600;color:#cbd5e1;">${text}</div>
        <div style="font-size:12px;color:#93c5fd;">Sponsor: your-site@example.com</div>
      </div>
    `;
  }

  try {
    slots.forEach(s => fillSlot(s.id, s.text));
  } catch (e) {
    // no-op
    console.error('adStub failed', e);
  }
})();
