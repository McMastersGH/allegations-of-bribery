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
    // Add an inner label and sample CTA
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
