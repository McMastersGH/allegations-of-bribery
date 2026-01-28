// js/spellcheck.js
// Minimal LanguageTool client + UI for textarea inputs.

export function wireSpellcheck({ textareaId, buttonId }) {
  const textarea = document.getElementById(textareaId);
  const btn = document.getElementById(buttonId);
  if (!textarea || !btn) return;

  // Create result panel
  let panel = document.createElement('div');
  panel.className = 'rounded-md border border-stroke bg-panel p-3 mt-3 text-sm';
  panel.style.display = 'none';

  const title = document.createElement('div');
  title.className = 'font-semibold mb-2';
  title.textContent = 'Spell & Grammar Suggestions';
  panel.appendChild(title);

  const list = document.createElement('div');
  panel.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'mt-3 flex gap-2';

  const applyAllBtn = document.createElement('button');
  applyAllBtn.className = 'btn';
  applyAllBtn.textContent = 'Apply all suggestions';
  applyAllBtn.type = 'button';
  applyAllBtn.addEventListener('click', () => applyAll(list, textarea));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn ghost';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => (panel.style.display = 'none'));

  actions.appendChild(applyAllBtn);
  actions.appendChild(closeBtn);
  panel.appendChild(actions);

  textarea.parentNode.insertBefore(panel, textarea.nextSibling);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    list.innerHTML = '';
    panel.style.display = 'block';
    const text = textarea.value || '';
    if (!text.trim()) {
      list.textContent = 'No text to check.';
      return;
    }

    try {
      const form = new URLSearchParams();
      form.append('text', text);
      form.append('language', 'en-US');

      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`LanguageTool returned ${res.status}`);
      const data = await res.json();
      const matches = data.matches || [];
      if (!matches.length) {
        list.textContent = 'No issues found.';
        return;
      }

      // Build UI for each match
      matches.forEach((m, idx) => {
        const row = document.createElement('div');
        row.className = 'mb-3';

        const context = document.createElement('div');
        context.className = 'text-xs muted';
        context.textContent = `${m.rule ? m.rule.issueType || '' : ''} — ${m.message}`;
        row.appendChild(context);

        const excerpt = document.createElement('div');
        excerpt.className = 'mt-1';
        const excerptText = text.slice(Math.max(0, m.offset - 40), m.offset + m.length + 40);
        excerpt.textContent = excerptText.replace(/\n/g, ' ');
        row.appendChild(excerpt);

        const replContainer = document.createElement('div');
        replContainer.className = 'mt-2 flex gap-2';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn';
        applyBtn.type = 'button';
        applyBtn.textContent = m.replacements && m.replacements[0] ? `Apply: ${m.replacements[0].value}` : 'No replacement';
        applyBtn.disabled = !(m.replacements && m.replacements.length);
        applyBtn.addEventListener('click', () => applySingle(m, textarea));

        replContainer.appendChild(applyBtn);

        // Show other suggestions if present
        if (m.replacements && m.replacements.length > 1) {
          const more = document.createElement('div');
          more.className = 'text-xs muted';
          more.textContent = m.replacements.slice(1, 4).map(r => r.value).join(', ');
          replContainer.appendChild(more);
        }

        row.appendChild(replContainer);
        list.appendChild(row);
      });
    } catch (err) {
      list.textContent = `Spellcheck failed: ${String(err)}`;
      console.error(err);
    }
  });
}

function applySingle(match, textarea) {
  if (!match || !match.replacements || !match.replacements[0]) return;
  const text = textarea.value || '';
  const repl = match.replacements[0].value;
  // apply replacement at offset/length; work from original text
  const before = text.slice(0, match.offset);
  const after = text.slice(match.offset + match.length);
  textarea.value = before + repl + after;
}

function applyAll(listEl, textarea) {
  // Gather matches from the displayed list by parsing buttons' dataset if available.
  // Simpler approach: re-run LanguageTool and apply matches from end to start.
  (async () => {
    const text = textarea.value || '';
    if (!text) return;
    try {
      const form = new URLSearchParams();
      form.append('text', text);
      form.append('language', 'en-US');

      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const data = await res.json();
      const matches = (data.matches || []).filter(m => m.replacements && m.replacements.length);
      // Apply from last to first to preserve offsets
      let newText = text;
      matches.sort((a, b) => (b.offset || 0) - (a.offset || 0));
      for (const m of matches) {
        const repl = m.replacements[0].value;
        newText = newText.slice(0, m.offset) + repl + newText.slice(m.offset + m.length);
      }
      textarea.value = newText;
    } catch (e) {
      console.error('applyAll failed', e);
    }
  })();
}
