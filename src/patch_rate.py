"""One-time patch: wire the Rate and Day stats tabs, lightbox and rating state into app.js, body.html, app.css, build.py."""
import pathlib, re
S=pathlib.Path(__file__).parent
def sub(path, old, new, count=1):
    p=S/path; t=p.read_text(encoding='utf-8')
    assert old in t, f'{path}: anchor not found: {old[:60]}'
    t=t.replace(old,new,count); p.write_text(t,encoding='utf-8')
app=(S/'app.js').read_text(encoding='utf-8')
ui=(S/'rate_ui.js').read_text(encoding='utf-8')
if 'renderRate' in app:
    a=app.index('// ---------- rate & day stats ----------'); b=app.index('// ---------- events ----------')
    (S/'app.js').write_text(app[:a]+ui+'\n'+app[b:],encoding='utf-8')
else:
    sub('app.js',"// ---------- events ----------", ui+"\n// ---------- events ----------")
    sub('app.js',"const TABS=[['today','Today'],['days','Days'],['map','Map'],['places','Places'],","const TABS=[['today','Today'],['days','Days'],['rate','Rate'],['stats','Day stats'],['map','Map'],['places','Places'],")
    sub('app.js',"const TAB_ICON={today:'daruma',days:'train',map:'fuji',","const TAB_ICON={today:'daruma',days:'train',rate:'sparkle',stats:'shiba',map:'fuji',")
    sub('app.js',"({today:renderToday,days:renderDays,map:renderMap,","({today:renderToday,days:renderDays,rate:renderRate,stats:renderStats,map:renderMap,")
    sub('app.js',"const STATE={checks:{},order:{},edits:{},","const STATE={checks:{},order:{},edits:{},rate:{},")
    sub('app.js',"if(d.edits&&typeof d.edits==='object') STATE.edits=JSON.parse(JSON.stringify(d.edits));","if(d.edits&&typeof d.edits==='object') STATE.edits=JSON.parse(JSON.stringify(d.edits)); if(d.rate&&typeof d.rate==='object') STATE.rate=JSON.parse(JSON.stringify(d.rate));")
    # click handlers: insert before the generic place/go/tab handler
    sub('app.js',"  const t=e.target.closest('[data-place],[data-go],[data-tab],#drawer-close,#scrim'); if(!t) return;",
"""  const lb=e.target.closest('[data-lb]'); if(lb){ const [id,i]=lb.dataset.lb.split(':'); openLB(id,Number(i)); return; }
  if(e.target.closest('#lb')){ const n=e.target.closest('.nav,.lb-x'); if(n){ if(n.classList.contains('lb-x')) closeLB(); else stepLB(n.classList.contains('prev')?-1:1); } else if(e.target.id==='lb'||e.target.id==='lb-stage') closeLB(); return; }
  const rx=e.target.closest('[data-x]'); if(rx){ requireEdit(()=>{ const [id,x]=rx.dataset.x.split(':'); const cur=rateOf(id); setRate(id,{x:cur&&cur.x===Number(x)?null:Number(x)}); refreshCard(id); }); return; }
  const rm=e.target.closest('[data-must]'); if(rm){ requireEdit(()=>{ const id=rm.dataset.must; const cur=rateOf(id); setRate(id,{must:!(cur&&cur.must)}); refreshCard(id); toast(rateOf(id)&&rateOf(id).must?'Can’t miss':'Unflagged'); }); return; }
  const sc=e.target.closest('[data-scroll]'); if(sc){ e.preventDefault(); const el=document.getElementById(sc.dataset.scroll); if(el) el.scrollIntoView({block:'start',behavior:'smooth'}); return; }
  const t=e.target.closest('[data-place],[data-go],[data-tab],#drawer-close,#scrim'); if(!t) return;""")
    sub('app.js',"document.addEventListener('change',e=>{ const c=e.target.closest('[data-check]'); if(!c) return;",
"""document.addEventListener('change',e=>{ const rc=e.target.closest('[data-rc]'); if(rc){ const id=rc.dataset.rc, val=rc.value.trim(); if(!canEdit()){ rc.value=(rateOf(id)||{}).c||''; requireEdit(()=>{ setRate(id,{c:val}); refreshCard(id); }); return; } setRate(id,{c:val}); return; }
  const c=e.target.closest('[data-check]'); if(!c) return;""")
    sub('app.js',"document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeDrawer(); $('#pw').hidden=true; }",
        "document.addEventListener('keydown',e=>{ if(LB){ if(e.key==='Escape'){ closeLB(); return; } if(e.key==='ArrowLeft'){ stepLB(-1); return; } if(e.key==='ArrowRight'){ stepLB(1); return; } } if(e.key==='Escape'){ closeDrawer(); $('#pw').hidden=true; }")
    # swipe in the lightbox
    sub('app.js',"// ---------- boot ----------",
"""let swX=null; document.addEventListener('touchstart',e=>{ if(LB) swX=e.touches[0].clientX; },{passive:true}); document.addEventListener('touchend',e=>{ if(LB&&swX!=null){ const dx=e.changedTouches[0].clientX-swX; if(Math.abs(dx)>40) stepLB(dx<0?1:-1); } swX=null; },{passive:true});
// ---------- boot ----------""")
    sub('app.js',"Built from your 7 Google Maps lists (79 places, with the hours and ratings Maps shows)","Built from your 7 Google Maps lists (${PLACES.length} places, with the hours and ratings Maps shows)")
# body: new sections + lightbox
body=(S/'body.html').read_text(encoding='utf-8')
if 'view-rate' not in body:
    sub('body.html','<section class="view" id="view-days" hidden></section>','<section class="view" id="view-days" hidden></section>\n<section class="view" id="view-rate" hidden></section>\n<section class="view" id="view-stats" hidden></section>')
    sub('body.html','<div class="toast" id="toast"></div>','<div class="lb" id="lb" hidden><button class="lb-x" aria-label="Close">×</button><button class="nav prev" aria-label="Previous">‹</button><div class="lb-stage" id="lb-stage"></div><button class="nav next" aria-label="Next">›</button><div><div class="lb-dots" id="lb-dots"></div><div class="lb-cap" id="lb-cap"></div></div></div>\n<div class="toast" id="toast"></div>')
# css
css=(S/'app.css').read_text(encoding='utf-8')
if '.rcard' not in css:
    (S/'app.css').write_text(css.rstrip()+'\n'+(S/'rate.css').read_text(encoding='utf-8'),encoding='utf-8')
# build: emit RATE and GALLERY from json
b=(S/'build.py').read_text(encoding='utf-8')
if 'rate.json' not in b:
    sub('build.py',"js=''.join(r(f) for f in ['place_photos.js','japan.js','places.generated.js','data.js','photos.js','app.js'])",
        "js=''.join(r(f) for f in ['place_photos.js','japan.js','places.generated.js','data.js','photos.js'])+'window.RATE='+r('rate.json').strip()+';\\nwindow.GALLERY='+r('gallery.json').strip()+';\\n'+r('app.js')")
print('patched')
