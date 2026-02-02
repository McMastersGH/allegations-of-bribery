import { getAllForums } from './forumApi.js';

const $ = id => document.getElementById(id);

function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;"); }

function renderList(rows){
  const wrap = $('forumsList');
  if(!wrap) return;
  if(!rows?.length){ wrap.innerHTML = '<div class="py-4 text-sm text-slate-400">No forums yet.</div>'; return; }
  wrap.innerHTML = rows.map(r=>{
    const title = escapeHtml(r.title || r.slug);
    const desc = escapeHtml(r.description || '');
    const slug = encodeURIComponent(r.slug);
    const counts = `Threads: ${r.posts_count ?? 0} • Comments: ${r.comments_count ?? 0}`;
    return `
      <a href="./forum.html?forum=${slug}" class="group block rounded-lg border border-stroke bg-panel p-4 hover:bg-slate-800">
        <div class="flex items-start gap-3">
          <div class="mt-1 flex h-12 w-12 items-center justify-center rounded-md bg-slate-700 text-slate-200">
            <span class="text-sm font-bold">${(r.title||r.slug).split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase()}</span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center justify-between gap-3">
              <h3 class="truncate text-sm font-semibold group-hover:text-white">${title}</h3>
              <span class="shrink-0 text-xs text-slate-500">View</span>
            </div>
            <p class="mt-1 line-clamp-2 text-xs text-slate-400">${desc}</p>
            <div class="mt-3 flex items-center gap-4 text-xs text-slate-500">${counts}</div>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

(async ()=>{
  try{
    const rows = await getAllForums({ onlyActive: true });
    renderList(rows);
  }catch(e){
    console.error('forums list failed',e);
    const wrap = $('forumsList'); if(wrap) wrap.innerHTML = `<div class="py-4 text-sm text-rose-300">Failed to load forums: ${String(e)}</div>`;
  }
})();
