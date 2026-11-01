(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TRIP=window.TRIP, PLACES=window.PLACES, SUGG=window.SUGGESTIONS, DAYS=window.DAYS;
const ALL={};
PLACES.forEach(p=>{ALL[p.id]=p;});
SUGG.forEach(s=>{ALL[s.id]=Object.assign({src:s.you?'you':'pick',list:s.you?'Your notes':'Claude pick',note:'',reviews:null,rating:null,tip:''},s);});
const fmtY=n=>'¥'+Math.round(n).toLocaleString('en-US');
const fmtR=n=>'₹'+Math.round(n).toLocaleString('en-IN');
const DOWS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function niceDate(iso){const [y,m,d]=iso.split('-').map(Number);return `${DOWS[new Date(Date.UTC(y,m-1,d)).getUTCDay()]} ${MONTHS[m-1]} ${d}`;}
function todayJST(){try{return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'});}catch(e){return new Date().toISOString().slice(0,10);}}
function daysBetween(a,b){return Math.round((Date.parse(b)-Date.parse(a))/86400000);}
function mapsLink(p){ if(p.maps) return p.maps; return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.name+' '+(p.area||'Japan')); }
function dirLink(a,b,mode){return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${mode}`;}
function hav(a,b){const R=6371,toR=x=>x*Math.PI/180;const dLat=toR(b.lat-a.lat),dLng=toR(b.lng-a.lng);const h=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function estHop(km,drive){ if(drive) return {min:Math.round(km/35*60+5),mode:'drive'}; if(km<1.3) return {min:Math.round(km/4.5*60),mode:'walk'}; return {min:Math.round(12+km*2.2),mode:'transit'}; }
const ICON=(n,c='')=>`<svg class="ico ${c}" aria-hidden="true"><use href="#k-${n}"/></svg>`;
const TAB_ICON={today:'daruma',days:'train',map:'fuji',places:'lantern',shop:'bag',check:'sparkle',budget:'yen',guide:'neko'};
const DAY_MASCOT={1:'robot',2:'camera',3:'car',4:'fuji',5:'torii',6:'momiji',7:'deer',8:'controller',9:'skytree',10:'plane'};
const TAG_ICON={cyberpunk:'robot',drinking:'beer',shopping:'bag',vintage:'camera',drive:'car',nature:'momiji',chill:'onsen',countryside:'ginkgo',culture:'torii',food:'ramen',spirituality:'torii',anime:'controller',arcade:'controller',travel:'plane'};
function catIcon(p){const t=((p.cat||'')+' '+(p.list||'')).toLowerCase(); const has=r=>r.test(t);
  if(has(/hotel|hostel|inn|ryokan/)) return 'onsen'; if(has(/car rental|jdm|toll road|cafe/)&&!has(/dog/)) return 'car'; if(has(/dog cafe/)) return 'shiba';
  if(has(/temple|shrine|cemetery/)) return 'torii'; if(has(/camera/)) return 'camera'; if(has(/knife|martial/)) return 'katana';
  if(has(/ramen|udon|sushi|pizza|restaurant|curry|wings|steak|donburi|kaiseki|yakiniku|bakery|mochi|wagashi|food market|confection|tsukemen/)) return 'ramen';
  if(has(/bar|yakitori|tachinomi|izakaya/)) return 'beer'; if(has(/tea shop/)) return 'tea'; if(has(/arcade|game|retro/)) return 'controller';
  if(has(/store|shopping|mall|market|flea|antique|records|stationery|sneakers|toy|collectibles|thrift|electronics|fabric|discount/)) return 'bag';
  if(has(/station|airport|train/)) return 'train'; if(has(/viewpoint|garden|park|scenic|island|river|valley|bridge|forest|lake|avenue|pass|road|skyline|turnpike/)) return 'momiji';
  if(has(/museum|castle|aquarium|observation|theater|digital art|showroom|historic|landmark/)) return 'lantern'; return 'onigiri'; }
function photoFor(key){return (window.PHOTOS||{})[key]||null;}
function placePhoto(id){const r=(window.PLACE_PHOTOS||{})[id]; return r&&r.file?r:null;}
function thumb(pp){return pp.file.replace('img/pl/','img/pl/t/');}
function srcChip(p){return p.src==='you'?`<span class="chip you">Your list</span>`:`<span class="chip pick">Claude pick</span>`;}

// ---------- state + storage ----------
const STATE={checks:{},order:{},edits:{},budget:{tier:'mid',rate:TRIP.rateINRperJPY,over:{}},expenses:[],updated:0};
const EDIT_PW='snehaljapan';
function canEdit(){try{return localStorage.getItem('jt-edit')==='ok';}catch(e){return false;}}
function setEdit(v){try{ if(v) localStorage.setItem('jt-edit','ok'); else localStorage.removeItem('jt-edit'); }catch(e){} renderHeader();}
let pendingEdit=null;
function requireEdit(fn){ if(canEdit()) return fn(); pendingEdit=fn; $('#pw').hidden=false; $('#scrim').hidden=false; const i=$('#pwin'); i.value=''; $('#pwerr').hidden=true; setTimeout(()=>i.focus(),50); }
function merge(d){ if(!d||typeof d!=='object') return; if(d.checks) STATE.checks=Object.assign({},d.checks); if(d.budget) STATE.budget=Object.assign({tier:'mid',rate:TRIP.rateINRperJPY,over:{}},d.budget); if(Array.isArray(d.expenses)) STATE.expenses=d.expenses.slice(); if(d.order&&typeof d.order==='object') STATE.order=Object.assign({},d.order); if(d.edits&&typeof d.edits==='object') STATE.edits=JSON.parse(JSON.stringify(d.edits)); if(d.updated) STATE.updated=d.updated; }
let saveTimer=null, writeChain=Promise.resolve();
const Store={docRef:null,
  async init(){
    try{const raw=localStorage.getItem('japan-trip-state'); if(raw) merge(JSON.parse(raw));}catch(e){}
    try{
      if(window.claude&&typeof window.claude.use==='function'){
        const db=await window.claude.use('db');
        if(db){ this.docRef=db.doc('trip/state');
          this.docRef.onSnapshot(snap=>{
            if(!snap.exists){ if(STATE.updated) Store.push(); return; }
            const d=snap.data()||{};
            if((d.updated||0)>(STATE.updated||0)){ merge(d); try{localStorage.setItem('japan-trip-state',JSON.stringify(STATE));}catch(e){} renderCurrent(); setSync('Synced'); }
            else if((d.updated||0)<(STATE.updated||0)) Store.push();
            else setSync('Synced');
          },err=>{console.warn('db',err); setSync('This device only');});
        } else setSync('This device only');
      } else setSync('This device only');
    }catch(e){console.warn(e); setSync('This device only');}
  },
  save(){ STATE.updated=Date.now(); try{localStorage.setItem('japan-trip-state',JSON.stringify(STATE));}catch(e){} clearTimeout(saveTimer); saveTimer=setTimeout(()=>Store.push(),700); },
  push(){ if(!this.docRef) return; const body=JSON.parse(JSON.stringify(STATE)); writeChain=writeChain.then(()=>this.docRef.set(body)).then(()=>setSync('Synced'),e=>{console.warn(e); setSync('Saved on this device');}); }
};
function setSync(t){const el=$('#sync'); if(el) el.textContent=t;}
function isChecked(id){return !!STATE.checks[id];}
function toggle(id,v){ if(v) STATE.checks[id]=true; else delete STATE.checks[id]; Store.save(); }

// ---------- toast + drawer ----------
let toastT=null; function toast(t){const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),1400);}
function openPlace(id){ const p=ALL[id]; if(!p) return; const dayFor=DAYS.filter(d=>d.stops.some(s=>s.ref===id&&!s.opt)); const dayTxt=dayFor.length?dayFor.map(d=>`<a class="link" href="#day${d.n}" data-go="days" data-day="${d.n}">Day ${d.n} · ${niceDate(d.date)}</a>`).join(' · '):(p.day?`suggested Day ${p.day}`:'not scheduled');
  const pp=placePhoto(p.id); $('#drawer-body').innerHTML=`<div class="place">${pp?`<img class="hero-img" src="${esc(pp.file)}" alt="${esc(p.name)}" decoding="async">`:''}<div class="head"><span class="sticker">${ICON(catIcon(p))}</span><b>${esc(p.name)}</b> ${srcChip(p)} <span class="chip tag">${esc(p.cat||'')}</span></div>
  ${p.rating?`<div class="rating">★ ${p.rating} · ${Number(p.reviews||0).toLocaleString('en-US')} reviews · ${esc(p.list)}</div>`:`<div class="rating">${esc(p.list)}</div>`}
  <dl class="kv">
   ${p.area?`<dt>Area</dt><dd>${esc(p.area)}</dd>`:''}
   ${p.address?`<dt>Address</dt><dd>${esc(p.address)}</dd>`:''}
   ${p.hours?`<dt>Hours</dt><dd>${esc(p.hours)}</dd>`:''}
   ${p.best?`<dt>Best time</dt><dd>${esc(p.best)}</dd>`:''}
   ${p.use?`<dt>Why</dt><dd>${esc(p.use)}</dd>`:''}
   ${p.note?`<dt>Your note</dt><dd>“${esc(p.note)}”</dd>`:''}
   ${p.tip?`<dt>Tip</dt><dd>${esc(p.tip)}</dd>`:''}
   <dt>When</dt><dd>${dayTxt}</dd>
  </dl>
  ${pp&&pp.page?`<div class="src-note">Photo: <a target="_blank" rel="noopener" href="${esc(pp.page)}">${esc((pp.title||pp.page).slice(0,70))}</a></div>`:''}
  <div class="pills"><a class="btn small" target="_blank" rel="noopener" href="${esc(mapsLink(p))}">Open in Google Maps</a><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=transit">Directions here</a></div></div>`;
  $('#drawer').hidden=false; $('#scrim').hidden=false; }
function closeDrawer(){$('#drawer').hidden=true; if($('#pw').hidden) $('#scrim').hidden=true;}

// ---------- tabs ----------
const TABS=[['today','Today'],['days','Days'],['map','Map'],['places','Places'],['shop','Shop & eat'],['check','Checklist'],['budget','Budget'],['guide','Guide']];
let current='today';
function show(tab,opts){ if(!TABS.some(t=>t[0]===tab)) tab='today'; current=tab; document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab?'true':'false')); document.querySelectorAll('section.view').forEach(s=>s.hidden=s.id!=='view-'+tab); renderCurrent(); if(history.replaceState) history.replaceState(null,'','#'+tab); window.scrollTo({top:0}); if(opts&&opts.day){ const el=document.getElementById('day-'+opts.day); if(el) el.scrollIntoView({block:'start'}); } }
function renderCurrent(){ ({today:renderToday,days:renderDays,map:renderMap,places:renderPlaces,shop:renderShop,check:renderCheck,budget:renderBudget,guide:renderGuide})[current](); renderHeader(); }

// ---------- header ----------
function renderHeader(){ const lk=$('#lock'); if(lk) lk.innerHTML=canEdit()?`<button class="btn small" id="lockbtn">Editing on · lock</button>`:`<button class="btn small" id="lockbtn">View only · unlock to edit</button>`; const t=todayJST(); const n=daysBetween(t,TRIP.start); let txt; if(n>0) txt=`<b>${n}</b> days to Haneda`; else if(t<=TRIP.end) txt=`Day <b>${daysBetween(TRIP.start,t)+1}</b> of 10 · ${niceDate(t)}`; else txt='Trip complete'; $('#countdown').innerHTML=txt+(TRIP.synced?` · lists synced ${niceDate(TRIP.synced)}`:''); }

// ---------- day card ----------
function costOf(p){ if(!p) return 0; if(p.cost!=null) return p.cost; const m=(p.use||'').match(/¥\s?([0-9][0-9,]{2,})/); if(m) return Number(m[1].replace(/,/g,'')); const t=((p.cat||'')+' '+(p.list||'')).toLowerCase(); if(/public bath/.test(t)) return 550; if(/hotel|hostel|inn|ryokan|station|car rental|district|ward|city|neighbourhood|street|market street|shopping street|road station|viewpoint|pass|island|river|bridge|avenue|shrine|festival/.test(t)) return 0; if(/temple|garden|park|cemetery/.test(t)) return 600; if(/museum|castle|aquarium|observation|digital art|theater|cinema/.test(t)) return 2200; if(/ramen|udon|curry|donburi|bakery|mochi|wagashi|confection|yakitori|wings/.test(t)) return 1200; if(/sushi|pizza|steak|kaiseki|yakiniku|restaurant|food market/.test(t)) return 2500; if(/bar|tachinomi|cocktail|pub/.test(t)) return 3500; if(/class|workshop|experience|omakase/.test(t)) return 6000; if(/arcade|game/.test(t)) return 1500; return 0; }
function durOf(s,p){ if(s.dur) return s.dur; const t=((p&&p.cat)||'').toLowerCase(); if(/class|workshop|experience|theater|cinema|digital art|tour/.test(t)) return 120; if(/museum|aquarium|castle|garden|flea|antique|market/.test(t)) return 90; if(/temple|shrine|viewpoint|bridge|pass|river/.test(t)) return 40; if(/bar|pub|arcade|night light/.test(t)) return 90; if(/ramen|udon|curry|donburi/.test(t)) return 45; if(/restaurant|sushi|pizza|steak|kaiseki|yakiniku|wings/.test(t)) return 75; if(/store|shop|mall|camera|records|knife|stationery|sneakers|toy|thrift|collectibles|electronics|audio|keyboard/.test(t)) return 50; if(/hotel|hostel|inn/.test(t)) return 30; return 60; }
function parseT(t){const m=/^(\d{1,2}):(\d{2})$/.exec(t||''); return m?Number(m[1])*60+Number(m[2]):null;}
function fmtT(m){m=Math.round(m); const h=Math.floor(m/60)%24, mm=m%60; return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;}
function closingOn(p,dow){ if(!p||!p.hours) return null; const H=p.hours; if(/24 ?h/i.test(H)) return 24*60; const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; let seg=null; for(const part of H.split(';')){ const q=part.trim(); const m=/^(Daily|([A-Z][a-z]{2})(?:–([A-Z][a-z]{2}))?)\s+(.*)$/.exec(q); if(!m) continue; if(m[1]==='Daily'){seg=m[4]; break;} const a=days.indexOf(m[2]), b=m[3]?days.indexOf(m[3]):a, i=days.indexOf(dow); if(a>=0&&i>=a&&i<=b){seg=m[4]; break;} } if(seg==null) return null; if(/closed/i.test(seg)) return 0; const ranges=[...seg.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi)]; if(!ranges.length) return null; const r=ranges[ranges.length-1]; let h=Number(r[4]), mm=Number(r[5]||0); const ap=r[6].toLowerCase(); if(ap==='pm'&&h<12) h+=12; if(ap==='am'&&h===12) h=0; let v=h*60+mm; if(v<6*60) v+=24*60; return v; }
function swapKey(d,i){return `swap:${d.n}:${i}`;}
// ---- free-form edits: swaps to any place, added stops ----
function dayEdits(n){ return (STATE.edits||{})[String(n)]||null; }
function ensureEdits(n){ STATE.edits=STATE.edits||{}; return STATE.edits[String(n)]=STATE.edits[String(n)]||{sw:{},add:[]}; }
function materialize(d){ if(d._mat) return d; const e=dayEdits(d.n); if(!e||(!Object.keys(e.sw||{}).length&&!(e.add||[]).length)) return d;
  const stops=d.stops.map((s,i)=>{ const pid=e.sw&&e.sw[String(i)]; const p=pid&&ALL[pid]; if(!p||s.opt) return s; return {t:s.t,ref:p.id,note:(p.use||'')+(p.tip?' '+p.tip:''),travel:'',swapped:true,orig:s.ref||s.title||''}; });
  (e.add||[]).forEach(a=>{ const p=ALL[a.ref]; if(p) stops.push({t:'',ref:p.id,note:p.use||'',travel:'',added:true,after:a.after}); });
  return Object.assign({},d,{stops,_mat:true,_n0:d.stops.length}); }
function hasEdits(d){ const e=dayEdits(d.n); return !!(e&&(Object.keys(e.sw||{}).length||(e.add||[]).length)); }
const DOWI={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
function parseClock(txt,mer){ const m=txt.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i); if(!m) return null; let h=+m[1], mi=+(m[2]||0); const me=(m[3]||mer||'').toLowerCase(); if(me==='pm'&&h<12) h+=12; if(me==='am'&&h===12) h=0; return h*60+mi; }
function parseRanges(txt){ if(/open 24h|24 hours/i.test(txt)) return [[0,1440]]; if(/closed/i.test(txt)) return []; const out=[]; txt.split(',').forEach(seg=>{ const m=seg.trim().match(/^(.+?)[–-](.+)$/); if(!m) return; const endMer=(m[2].match(/am|pm/i)||[''])[0]; const e=parseClock(m[2]); const st=parseClock(m[1],endMer); if(st==null||e==null) return; out.push([st,e<=st?e+1440:e]); }); return out; }
function hoursOn(hours,dow){ if(!hours) return null; const di=DOWI[dow]; for(const seg of hours.split(';').map(x=>x.trim()).filter(Boolean)){ const m=seg.match(/^((?:(?:Daily|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[–-](?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))?,?\s*)+)\s+(.*)$/i); if(!m) continue; const days=new Set(); m[1].split(',').forEach(part=>{ const pm=part.trim().match(/^(Daily|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[–-](Mon|Tue|Wed|Thu|Fri|Sat|Sun))?$/i); if(!pm) return; if(/daily/i.test(pm[1])){ for(let k=1;k<=7;k++) days.add(k); return; } const cap=x=>x[0].toUpperCase()+x.slice(1,3).toLowerCase(); const a=DOWI[cap(pm[1])], b=pm[2]?DOWI[cap(pm[2])]:a; for(let k=a;k<=b;k++) days.add(k); }); if(days.has(di)) return parseRanges(m[2]); } return null; }
function openAt(hours,dow,min){ const r=hoursOn(hours,dow); if(r===null) return null; return r.some(([a,b])=>(min>=a&&min<b)||(min+1440>=a&&min+1440<b)); }
function scheduledIn(pid){ const r=[]; DAYS.forEach(d0=>{ const d=materialize(d0); const {act}=effective(d); if(d.stops.some((s,i)=>act[i]&&s.ref===pid)) r.push(d.n); }); return r; }
function candidates(d0,i,addMode,q){ const d=materialize(d0); const {act,order}=effective(d); const sc=schedule(d); const cur=d.stops[i]; const curP=cur&&cur.ref?ALL[cur.ref]:null;
  const actOrder=order.filter(k=>act[k]&&d.stops[k].ref&&ALL[d.stops[k].ref]&&ALL[d.stops[k].ref].lat); const pos=actOrder.indexOf(i);
  let prev=null,next=null; const oi=order.indexOf(i); const before=order.slice(0,oi).reverse().find(k=>actOrder.includes(k)), after=order.slice(oi+1).find(k=>actOrder.includes(k));
  if(addMode){ prev=pos>=0?ALL[d.stops[i].ref]:(before!=null?ALL[d.stops[before].ref]:null); next=after!=null?ALL[d.stops[after].ref]:null; }
  else { prev=before!=null?ALL[d.stops[before].ref]:null; next=after!=null?ALL[d.stops[after].ref]:null; }
  const n=sc.notes[i]||{}; const slot=addMode?((n.est!=null?n.est+(n.dur||45):null)||sc.end||600):(n.est!=null?n.est:(parseT(cur&&cur.t)||600));
  const inDay=new Set(actOrder.map(k=>d.stops[k].ref)); const ql=(q||'').toLowerCase();
  const list=Object.values(ALL).filter(p=>p.lat&&!p.dup&&p.lat>20&&p.lng>120&&p.id!==(curP&&curP.id)&&!inDay.has(p.id)).filter(p=>!ql||(p.name+' '+(p.area||'')+' '+(p.cat||'')+' '+(p.note||'')+' '+(p.list||'')).toLowerCase().includes(ql));
  const base=prev&&next?hav(prev,next):0;
  return list.map(p=>{ let score=0; const pros=[],cons=[];
    if(p.src==='you'){ score+=40; pros.push('On your '+p.list+' list'+(p.note?' · “'+p.note+'”':'')); } else cons.push('Claude pick, not on your lists');
    let detour=0; if(prev&&next) detour=hav(prev,p)+hav(p,next)-base; else if(prev) detour=hav(prev,p); else if(next) detour=hav(p,next);
    const dmin=detour>0.05?estHop(detour,d.drive).min:0; score-=Math.min(60,dmin*0.9);
    if(prev||next){ const anchor=prev||next; const near=hav(anchor,p); pros.push((near<1?Math.round(near*1000)+' m':near.toFixed(1)+' km')+' from '+anchor.name.split(' (')[0]+(dmin>0?' · adds ~'+Math.round(dmin)+' min of travel':'')); if(dmin>45) cons.push('Big detour for this slot'); }
    const o=openAt(p.hours,d.dow,slot); if(o===true){ score+=15; pros.push('Open at ~'+fmtT(slot)+' on '+d.dow); } else if(o===false){ score-=45; cons.push('Closed at ~'+fmtT(slot)+' on '+d.dow+' ('+p.hours+')'); } else if(p.hours) cons.push('Hours: '+p.hours); else cons.push('Hours unknown');
    const sd=scheduledIn(p.id).filter(x=>x!==d.n); if(sd.length){ score-=12; cons.push('Already planned on Day '+sd.join(', ')); } else { score+=10; pros.push('Not yet in the plan'); }
    if(curP&&!addMode&&catIcon(curP)===catIcon(p)){ score+=8; pros.push('Same kind of stop as '+curP.name.split(' (')[0]); }
    if(curP&&p.area&&curP.area===p.area) score+=6;
    const c=costOf(p); if(c) cons.push('about '+fmtY(c)); else pros.push('No entry cost'); cons.push('takes about '+durOf({},p)+' min');
    if(p.rating){ score+=p.rating*2; pros.push('★ '+p.rating+' · '+Number(p.reviews||0).toLocaleString('en-US')+' reviews'); }
    if(p.best) pros.push('Best: '+p.best);
    return {p,score,pros,cons}; }).sort((a,b)=>(b.p.src==='you')-(a.p.src==='you')||b.score-a.score); }
let SWAP=null;
function openSwap(n,i,addMode){ SWAP={n,i,addMode:!!addMode,q:''}; renderSwap(); $('#drawer').hidden=false; $('#scrim').hidden=false; }
function renderSwap(){ const {n,i,addMode,q}=SWAP; const d=materialize(DAYS.find(x=>x.n===n)); const cur=d.stops[i]; const curP=cur&&cur.ref?ALL[cur.ref]:null; const all=candidates(d,i,addMode,q); const you=all.filter(c=>c.p.src==='you').slice(0,10), picks=all.filter(c=>c.p.src!=='you').slice(0,6);
  const card=c=>{ const p=c.p, pp=placePhoto(p.id); return `<div class="cand"><div class="cand-head">${pp?`<img src="${esc(thumb(pp))}" alt="" loading="lazy">`:`<span class="sticker">${ICON(catIcon(p))}</span>`}<div style="min-width:0"><b>${esc(p.name)}</b> ${srcChip(p)}<div class="small muted">${esc(p.cat||'')}${p.area?' · '+esc(p.area):''}</div></div></div><ul class="pros">${c.pros.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><ul class="cons">${c.cons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="pills"><button class="btn small primary" data-usecand="${p.id}">${addMode?'Add here':'Use instead'}</button><button class="btn small" data-place="${p.id}">Details</button></div></div>`; };
  $('#drawer-body').innerHTML=`<div class="swap"><span class="eyebrow">Day ${d.n} · ${niceDate(d.date)} · ${addMode?'add a stop after':'swap or remove'}</span><h2>${addMode?'Add after: ':''}${curP?esc(curP.name):esc((cur&&cur.title)||'this stop')}</h2>
   <p class="small muted">${addMode?'Ranked by detour from the stops around it, opening hours at that time, cost and whether it is on your lists.':'Your lists first, then suggestions, ranked by detour from the neighbouring stops, opening hours at that time, cost and rating. The day re-times itself the moment you pick.'}</p>
   <div class="pills">${addMode?'':`<button class="btn small" data-menurm="${n}:${i}">Remove this stop</button>`}${cur&&cur.swapped?`<button class="btn small" data-unswap="${n}:${i}">Restore original</button>`:''}</div>
   <input id="swapq" type="search" placeholder="Search all ${Object.keys(ALL).length} places…" value="${esc(q)}" style="width:100%;padding:8px 10px;border:2px solid var(--line-2);border-radius:12px;background:var(--surface);margin-top:6px">
   ${you.length?`<div class="eyebrow" style="margin-top:10px">From your lists</div><div class="cands">${you.map(card).join('')}</div>`:''}${picks.length?`<div class="eyebrow" style="margin-top:10px">Suggestions</div><div class="cands">${picks.map(card).join('')}</div>`:''}${!all.length?'<p class="muted">Nothing matches.</p>':''}</div>`;
  const inp=$('#swapq'); let tm=null; inp.addEventListener('input',e=>{ clearTimeout(tm); tm=setTimeout(()=>{ SWAP.q=e.target.value; const pos=inp.selectionStart; renderSwap(); const i2=$('#swapq'); i2.focus(); i2.setSelectionRange(pos,pos); },150); }); }
function applySwap(pid){ const {n,i,addMode}=SWAP; const e=ensureEdits(n); const d0=DAYS.find(x=>x.n===n); if(addMode){ e.add.push({after:i,ref:pid}); delete STATE.order[n]; } else if(i>=d0.stops.length){ const k=i-d0.stops.length; if(e.add[k]) e.add[k].ref=pid; } else { e.sw[String(i)]=pid; delete STATE.checks[`skip:${n}:${i}`]; } Store.save(); closeDrawer(); renderCurrent(); toast(addMode?'Added, day re-timed':'Swapped, day re-timed'); }
function unswap(n,i){ const e=ensureEdits(n); delete e.sw[String(i)]; Store.save(); closeDrawer(); renderCurrent(); toast('Restored'); }
function unadd(n,i){ const d0=DAYS.find(x=>x.n===n); const e=ensureEdits(n); const k=i-d0.stops.length; if(k>=0) e.add.splice(k,1); delete STATE.order[n]; Store.save(); closeDrawer(); renderCurrent(); toast('Removed'); }

function orderOf(d){ const o=STATE.order[d.n]; const n=d.stops.length; if(Array.isArray(o)&&o.length===n&&new Set(o).size===n&&o.every(i=>i>=0&&i<n)) return o.slice(); const n0=d._n0!=null?d._n0:n; const base=d.stops.slice(0,n0).map((_,i)=>i); for(let k=n0;k<n;k++){ const a=d.stops[k].after; const at=base.indexOf(a); base.splice(at>=0?at+1:base.length,0,k); } return base; }
function effective(d){ d=materialize(d); const act=d.stops.map(s=>!s.opt); const out=d.stops.map(()=>null); const skipped=d.stops.map((s,i)=>!s.opt&&isChecked(`skip:${d.n}:${i}`)); skipped.forEach((v,i)=>{ if(v) act[i]=false; });
  d.stops.forEach((s,i)=>{ if(!s.opt) return; if(!isChecked(swapKey(d,i))) return; act[i]=true; if(s.swap){ const j=d.stops.findIndex((x,k)=>k!==i&&(x.ref===s.swap||x.title===s.swap)&&(!x.opt||isChecked(swapKey(d,k)))); if(j>=0&&act[j]){act[j]=false; out[j]=i;} } });
  const order=orderOf(d); const modified=skipped.some(Boolean)||d.stops.some((s,i)=>s.opt&&isChecked(swapKey(d,i)))||order.some((v,i)=>v!==i)||hasEdits(d);
  return {act,out,skipped,order,modified}; }
function schedule(d){ d=materialize(d); const {act,order,modified}=effective(d); const mode=d.drive; let cur=null, prev=null; const dowName=d.dow; let delta=0; const notes={};
  order.forEach(i=>{ const s=d.stops[i]; const p=s.ref?ALL[s.ref]:null; const authored=parseT(s.t); let est=null, hopMin=0, hopKm=0;
    if(act[i]){ if(cur==null) cur=authored!=null?authored:9*60; else if(authored!=null&&!modified) cur=authored; if(p&&p.lat&&prev){ hopKm=hav(prev,p); const e=estHop(hopKm,mode); hopMin=e.min; if(modified) cur+=hopMin; } est=cur; const dur=durOf(s,p); const close=p?closingOn(p,dowName):null; const flags=[]; if(close===0) flags.push('closed on '+dowName); else if(close!=null&&est+Math.min(dur,45)>close) flags.push('arrives after closing ('+fmtT(close)+')'); if(s.opt) delta+=costOf(p); cur=cur+dur; if(p&&p.lat) prev=p; notes[i]={est,flags,hopKm,hopMin,dur}; }
    else { notes[i]={est:null,flags:[],dur:0}; if(!s.opt&&s.ref) delta-=costOf(ALL[s.ref]); }
  });
  return {notes,delta,end:cur||0,modified}; }
function prosCons(d,i){ d=materialize(d); const s=d.stops[i]; const p=s.ref?ALL[s.ref]:null; if(!p) return null; const sc=schedule(d); const n=sc.notes[i]||{}; const pros=[], cons=[]; if(p.use) pros.push(p.use); if(p.best) pros.push('Best: '+p.best);
  const c=costOf(p); if(c) cons.push('about '+fmtY(c)+' more'); else pros.push('no extra cost'); cons.push('takes about '+durOf(s,p)+' min');
  if(s.swap){ const j=d.stops.findIndex((x,k)=>x.ref===s.swap||x.title===s.swap); if(j>=0){ const q=d.stops[j].ref?ALL[d.stops[j].ref]:null; if(q){ const cq=costOf(q); cons.push('replaces '+q.name.split(' (')[0]+(cq?' (saves '+fmtY(cq)+')':'')); if(p.lat&&q.lat){ const km=hav(p,q); if(km>3) cons.push(Math.round(km)+' km away from the stop it replaces'); } } } }
  (n.flags||[]).forEach(f=>cons.push(f)); if(sc.end>23*60+30) cons.push('day now ends around '+fmtT(sc.end)); if(n.hopKm>8&&!d.drive) cons.push('long hop ('+Math.round(n.hopKm)+' km) from the previous stop'); return {pros,cons}; }
function routeOf(d){ d=materialize(d); const {act,order}=effective(d); const route=[], seen=new Set(); order.forEach(i=>{ const s=d.stops[i]; if(!act[i]||!s.ref) return; const p=ALL[s.ref]; if(p&&p.lat&&!seen.has(p.id)){seen.add(p.id); route.push(Object.assign({t:s.t,travel:s.travel},p));} }); return route; }
function stopName(s){ if(s.ref){const p=ALL[s.ref]; if(!p) return esc(s.title||s.ref); return `<button class="pl" data-place="${p.id}">${esc(p.name)}</button> ${srcChip(p)}`;} return esc(s.title||''); }
function dayCard(d){ d=materialize(d); const mode=d.drive?'driving':'transit'; const eff=effective(d); const {act,out,order,modified}=eff; const sc=schedule(d); let prev=null; const editing=canEdit();
  const rows=order.map((i,pos)=>{ const s=d.stops[i]; const p=s.ref?ALL[s.ref]:null; const id=`done:${d.n}:${i}`; const done=isChecked(id); let dir=''; const isOpt=!act[i]; const n=sc.notes[i]||{};
    let sw=''; if(s.opt){ const on=isChecked(swapKey(d,i)); sw=`<button class="btn small" data-swap="${swapKey(d,i)}">${on?'Undo':(s.swap?'Switch in':'Add to day')}</button>${on?'<span class="chip pick">switched in</span>':''}`; }
    else if(out[i]!=null){ sw=`<button class="btn small" data-swap="${swapKey(d,out[i])}">Switch back</button><span class="chip tag">swapped out</span>`; }
    else { const sk=isChecked(`skip:${d.n}:${i}`); const n0=d._n0!=null?d._n0:d.stops.length; sw=(sk?`<button class="btn small" data-skip="skip:${d.n}:${i}">Restore</button><span class="chip tag">removed</span>`:`<button class="btn small" data-swapmenu="${d.n}:${i}">Swap</button><button class="btn small" ${i>=n0?`data-unadd="${d.n}:${i}"`:`data-skip="skip:${d.n}:${i}"`}>Remove</button>`)+(s.swapped?`<span class="chip pick">swapped in</span><button class="btn small" data-unswap="${d.n}:${i}">Restore ${esc((ALL[s.orig]&&ALL[s.orig].name.split(' (')[0])||'original')}</button>`:'')+(s.added?'<span class="chip pick">added</span>':'')+`<button class="btn small" data-addmenu="${d.n}:${i}">+ Add after</button>`; }
    const mv=act[i]?`<button class="btn small" data-move="${d.n}:${pos}:-1" aria-label="Move up">▲</button><button class="btn small" data-move="${d.n}:${pos}:1" aria-label="Move down">▼</button>`:'';
    const pc=(s.opt&&isChecked(swapKey(d,i)))?prosCons(d,i):null;
    const pcHtml=pc?`<div class="pc"><div><b>Pros</b><ul>${pc.pros.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><b>Cons</b><ul>${pc.cons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>`:'';
    const timeCell=(!isOpt&&n.est!=null)?((modified||parseT(s.t)==null)?`<span class="est" title="estimated after your changes">~${fmtT(n.est)}</span>`:esc(s.t)):esc(s.t);
    const flagHtml=(n.flags||[]).length?`<div class="warn">${n.flags.map(esc).join(' · ')}</div>`:'';
    if(p&&p.lat){ if(prev&&!isOpt&&prev.id!==p.id) dir=`<a class="link" target="_blank" rel="noopener" href="${esc(dirLink(prev,p,mode))}">Directions from ${esc(prev.name.split(' (')[0])}</a>`; if(!isOpt) prev=p; }
    const hours=p&&p.hours?`<span class="muted mono">${esc(p.hours)}</span>`:''; const pp=p?placePhoto(p.id):null;
    return `<div class="stop${isOpt?' opt':''}${done?' done':''}"><div class="t">${timeCell}</div><div class="row">${pp?`<img class="mini" src="${esc(thumb(pp))}" alt="" loading="lazy" decoding="async" data-place="${p.id}" style="cursor:pointer">`:''}<div class="body" style="min-width:0">
      <div class="name">${stopName(s)}</div>
      ${s.note?`<div class="note">${esc(s.note)}</div>`:''}
      ${s.travel?`<div class="travel">→ ${esc(s.travel)}</div>`:''}${modified&&n.hopKm?`<div class="travel">≈ ${n.hopKm<10?n.hopKm.toFixed(1):Math.round(n.hopKm)} km · ~${n.hopMin} min</div>`:''}
      ${flagHtml}
      <div class="meta">${hours}${p?`<a class="link" target="_blank" rel="noopener" href="${esc(mapsLink(p))}">Maps</a>`:''}${dir}<label class="small muted"><input type="checkbox" data-check="${id}" ${done?'checked':''}> done</label>${editing?sw+mv:''}</div>
      ${pcHtml}
    </div></div></div>`; }).join('');
  const tags=(d.tags||[]).map(t=>`<span class="chip tag ${esc(t)}">${TAG_ICON[t]?ICON(TAG_ICON[t]):''}${esc(t)}</span>`).join('')+(d.chill?`<span class="chip pick">${ICON('onsen')}chill day</span>`:'')+(d.drive?`<span class="chip you">${ICON('car')}car day</span>`:'')+(d.holiday?'<span class="chip tag">public holiday</span>':'');
  const ph=photoFor('d'+d.n); const cover=ph?`<div class="cover"><img src="${esc(ph.file)}" alt="${esc(ph.alt||'')}" loading="lazy" decoding="async"><span class="daynum">Day ${d.n}</span><span class="credit">📷 ${esc(ph.artist.split(' ')[0]||'Commons')}</span><span class="mascot sticker lg">${ICON(DAY_MASCOT[d.n]||'onigiri')}</span></div>`:'';
  const budget=d.budget+sc.delta; const deltaTxt=sc.delta?` <span class="${sc.delta>0?'warn-inline':'good-inline'}">(${sc.delta>0?'+':'−'}${fmtY(Math.abs(sc.delta))} from your changes)</span>`:'';
  const changes=modified?`<div class="changes"><span><b>After your changes:</b> the day runs until about ${fmtT(sc.end)}; budget ${fmtY(budget)}${deltaTxt}. Times marked ~ are estimates from distance and typical visit lengths; direction links follow the new order.</span> ${editing?`<button class="btn small" data-reset="${d.n}">Reset day</button>`:''}</div>`:'';
  const addBar=editing?`<div class="pills" style="margin-top:10px"><button class="btn small" data-addmenu="${d.n}:${order[order.length-1]}">+ Add a stop to this day</button><a class="btn small" href="#map" data-go="map" data-mapday="${d.n}">See on map</a></div>`:`<div class="pills" style="margin-top:10px"><a class="btn small" href="#map" data-go="map" data-mapday="${d.n}">See on map</a><span class="small muted">Unlock editing (🔒 in the header) to swap, remove or add stops.</span></div>`;
  return `<article class="card day" id="day-${d.n}">${cover}<div class="day-head"><span class="date">Day ${d.n} · ${niceDate(d.date)}</span><h2>${esc(d.title)}</h2></div>
   <div class="chips">${tags}<span class="chip day">stay: ${esc(d.base)}</span><span class="chip day">≈ ${fmtY(budget)} · ${fmtR(budget*STATE.budget.rate)}</span></div>
   <p class="why">${esc(d.why)}</p>${changes}<div class="stops">${rows}</div>${addBar}</article>`; }

// ---------- views ----------
function renderToday(){ const t=todayJST(); const v=$('#view-today'); const n=daysBetween(t,TRIP.start);
  const openBookings=window.CHECKLISTS[0].items.filter(i=>!isChecked(i.id));
  if(n>0){ const d=DAYS[0]; v.innerHTML=`<div class="stack"><div class="card hero"><div class="h-row"><span class="sticker lg">${ICON('plane')}</span><span class="sticker lg">${ICON('onigiri')}</span><span class="sticker lg">${ICON('neko')}</span></div><span class="eyebrow">Countdown</span><div class="big">${n} days until Haneda</div><p class="muted">Lands ${niceDate(TRIP.start)} 15:05 · home ${niceDate(TRIP.end)} 22:30. Nine nights: Tokyo 2, Hakone 1, Tokyo 1, Kyoto 2, Osaka 1, Tokyo 2.</p>
    <div class="pills"><button class="btn primary" data-go="check">Bookings left: ${openBookings.length}</button><button class="btn" data-go="days">Read the plan</button><button class="btn" data-go="budget">Set the budget</button></div></div>
    <div class="card"><span class="eyebrow">Book next</span>${openBookings.slice(0,6).map(i=>`<div class="check"><input type="checkbox" id="c-${i.id}" data-check="${i.id}"><label for="c-${i.id}">${esc(i.text)}</label></div>`).join('')||'<p class="muted">All bookings ticked.</p>'}</div>
    <span class="eyebrow">Preview: first evening</span>${dayCard(d)}</div>`; }
  else if(t<=TRIP.end){ const idx=daysBetween(TRIP.start,t); const d=DAYS[idx]||DAYS[DAYS.length-1]; const next=DAYS[idx+1];
    v.innerHTML=`<div class="stack"><div class="card hero"><div class="h-row"><span class="sticker lg">${ICON(DAY_MASCOT[d.n]||'onigiri')}</span><span class="eyebrow">Today in Japan · ${niceDate(t)}</span></div><div class="big">${esc(d.title)}</div><div class="pills"><button class="btn" data-go="map" data-mapday="${d.n}">Today on the map</button><button class="btn" data-go="budget">Log a spend</button>${next?`<button class="btn" data-go="days" data-day="${next.n}">Tomorrow: ${esc(next.title)}</button>`:''}</div></div>${dayCard(d)}</div>`; }
  else v.innerHTML=`<div class="card hero"><span class="eyebrow">Done</span><div class="big">Okaeri. Trip complete.</div><p class="muted">The budget tab still has your spend log; the places tab is your map for next time.</p></div>`; }

function renderDays(){ $('#view-days').innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Nine nights, Nov 16–25</span><div class="h-row"><span class="sticker lg">${ICON('train')}</span><h1>The plan</h1></div><p class="muted">Times are targets, not alarms. Dotted rows are options; tick stops as you go and they sync to your other devices.</p>
  <div class="chips">${DAYS.map(d=>`<a class="chip day" href="#day${d.n}" data-go="days" data-day="${d.n}">D${d.n} ${d.dow} ${d.date.slice(8)}</a>`).join('')}</div></div>${DAYS.map(dayCard).join('')}
  <div class="card"><span class="eyebrow">Where you sleep</span><div class="tablewrap"><table><thead><tr><th>Nights</th><th>Place</th><th>Estimate</th><th>Why</th></tr></thead><tbody>${window.STAYS.map(s=>`<tr><td class="mono">${esc(s.nights)}</td><td><button class="pl link" style="border:0;background:none;padding:0;cursor:pointer" data-place="${s.ref}">${esc(s.place)}</button></td><td class="mono">${esc(s.est)}</td><td class="muted">${esc(s.why)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><span class="eyebrow">On your lists but not scheduled</span><p class="muted small">Too far for nine nights, or dates collide. Each one says why in its card.</p><div class="chips">${PLACES.filter(p=>!p.day).map(p=>`<button class="chip you pl" data-place="${p.id}" style="border:0;cursor:pointer">${esc(p.name)}</button>`).join('')}</div></div></div>`; }

// ---------- map ----------
const VIEWS={tokyo:{label:'Tokyo',b:[35.57,139.58,35.79,139.91]},fuji:{label:'Hakone · Fuji · Izu',b:[34.9,138.5,35.62,139.25]},kansai:{label:'Kyoto · Nara · Osaka',b:[34.5,135.38,35.1,135.9]},japan:{label:'Honshu overview',b:[33.2,134.0,37.6,141.2]}};
const MAPV={view:'tokyo',day:0,live:null,trail:null}; let TRAIL_TIMER=null;
let LIVE_OK=null, LMAP=null, LLAYER=null;
(function probe(){ const im=new Image(); const t=setTimeout(()=>{if(LIVE_OK===null){LIVE_OK=false; if(current==='map') renderMap();}},5000); im.onload=()=>{clearTimeout(t); LIVE_OK=true; if(MAPV.live===null) MAPV.live=true; if(current==='map') renderMap();}; im.onerror=()=>{clearTimeout(t); LIVE_OK=false; if(current==='map') renderMap();}; im.src='https://tile.openstreetmap.org/5/28/12.png'; })();
let BASEMAP=null, BASEMAP_TRIED=false;
async function loadBasemap(){ if(BASEMAP||BASEMAP_TRIED) return BASEMAP; BASEMAP_TRIED=true; try{ const r=await fetch('data/basemap.json'); if(r.ok){ BASEMAP=await r.json(); if(current==='map') renderMap(); } }catch(e){} return BASEMAP; }
const LINE_COLORS=[['Ginza','#f39700'],['Marunouchi','#e60012'],['Hibiya','#9caeb7'],['Tozai','#00a7db'],['Chiyoda','#00ac9b'],['Yurakucho','#d7c447'],['Hanzomon','#9b7cb6'],['Namboku','#00ada9'],['Fukutoshin','#bb641d'],['Asakusa','#e85298'],['Mita','#0079c2'],['Shinjuku','#6cbb5a'],['Oedo','#b6007a'],['Yamanote','#9acd32'],['Chuo','#f15a22'],['Sobu','#ffd400'],['Keihin','#00bbdd'],['Saikyo','#00ac9a'],['Midosuji','#e5171f'],['Tanimachi','#522886'],['Yotsubashi','#0078ba'],['Chuo Line','#019a66'],['Sennichimae','#e44d93'],['Sakaisuji','#814721'],['Nagahori','#a9cc51'],['Imazatosuji','#ee7b1a'],['Karasuma','#5fb24b'],['Tozai Line','#e0202b'],['Keihan','#3fa74a'],['Hankyu','#8b1a3c'],['Kintetsu','#d34c45'],['Hanshin','#f58220'],['Odakyu','#2d8fd6'],['Keio','#d41e5a'],['Tokyu','#e30613'],['Seibu','#1f65b0'],['Keisei','#2c67b2'],['Tobu','#1a3b8e'],['Yurikamome','#1d9bd7'],['Rinkai','#2a8bb8'],['Hakone','#d62f2f'],['Fujikyu','#2e6fb7'],['Izu','#2b8f9e']];
function lineColor(n,type,dark){ const s=n||''; for(const [k,c] of LINE_COLORS){ if(s.includes(k)) return c; } if(type==='subway') return dark?'#8ab4f8':'#3b6fd6'; if(type==='monorail') return '#9b59b6'; return dark?'#8a93a6':'#6b7280'; }
function addVectorBasemap(map,dark){ if(!BASEMAP) return; const R=L.canvas({padding:0.4}); const water=dark?'#0e1a2b':'#cfe4f7', coast=dark?'#2d4d6b':'#8fb9df', road=dark?'#2f3647':'#e2d6c3', prim=dark?'#3a4257':'#f1e7d4';
  const waterL=L.layerGroup(), roadL=L.layerGroup(), railL=L.layerGroup(), staL=L.layerGroup(), labL=L.layerGroup(), placeL=L.layerGroup(); const staPts=[], placePts=[];
  for(const reg of Object.values(BASEMAP)){
    reg.water.forEach(w=>{ if(w.t==='coastline') L.polyline(w.c,{renderer:R,color:coast,weight:1.2,interactive:false}).addTo(waterL); else L.polygon(w.c,{renderer:R,color:coast,weight:0.5,fillColor:water,fillOpacity:1,interactive:false}).addTo(waterL); });
    reg.roads.forEach(r=>L.polyline(r.c,{renderer:R,color:r.t==='primary'?prim:road,weight:r.t==='motorway'?2.2:(r.t==='trunk'?1.6:1),interactive:false,opacity:.9}).addTo(roadL));
    reg.rail.forEach(r=>L.polyline(r.c,{renderer:R,color:lineColor(r.n,r.t,dark),weight:r.t==='subway'?2.4:1.8,opacity:r.t==='subway'?.95:.75,dashArray:r.t==='subway'?null:'6 4',interactive:false}).addTo(railL));
    reg.stations.forEach(s=>{ L.circleMarker([s.la,s.lo],{renderer:R,radius:2.6,color:dark?'#e8eaf0':'#171a21',weight:1,fillColor:dark?'#1a1e27':'#fff',fillOpacity:1,interactive:false}).addTo(staL); staPts.push(s); });
    reg.places.forEach(p=>placePts.push(p));
  }
  waterL.addTo(map); roadL.addTo(map); railL.addTo(map);
  const upd=()=>{ if(!map._loaded) return; const z=map.getZoom(); const b=map.getBounds().pad(0.15); if(z>=12) staL.addTo(map); else map.removeLayer(staL);
    labL.clearLayers(); placeL.clearLayers();
    if(z>=14){ let n=0; for(const s of staPts){ if(n>400) break; if(b.contains([s.la,s.lo])){ L.marker([s.la,s.lo],{icon:L.divIcon({className:'lbl sta',html:esc(s.n),iconAnchor:[-5,7]}),interactive:false}).addTo(labL); n++; } } labL.addTo(map); }
    if(z>=10&&z<16){ let n=0; for(const p of placePts){ const big=/city|town/.test(p.t||''); if(z<12&&!big) continue; if(n>150) break; if(b.contains([p.la,p.lo])){ L.marker([p.la,p.lo],{icon:L.divIcon({className:'lbl place'+(big?' big':''),html:esc(p.n),iconAnchor:[0,0]}),interactive:false}).addTo(placeL); n++; } } placeL.addTo(map); } };
  map.on('zoomend moveend',upd); upd(); }
function isDark(){return false;}
function renderLiveMap(day, route, pts){ const v=$('#view-map'); const side=day?dayHops(day,route):pointsPanel(pts);
  v.innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Live map</span><div class="h-row"><span class="sticker lg">${ICON('fuji')}</span><h1>Where everything is</h1></div><p class="muted">Pan, zoom, tap a pin. Red pins are your lists, teal are suggestions; pick a day to draw its route. Rail and metro lines, stations and districts come from OpenStreetMap${LIVE_OK?'':' (street tiles are blocked in this viewer, so the base is drawn from that data)'}.</p>
   <div class="maptools"><select id="mapday" aria-label="Choose a day"><option value="0">Choose a day to see your trail</option>${DAYS.map(d=>`<option value="${d.n}" ${MAPV.day===d.n?'selected':''}>Day ${d.n} · ${d.dow} ${d.date.slice(5)} · ${esc(d.title)}</option>`).join('')}</select><button class="btn small" id="locate">Locate me</button><button class="btn small" id="mapmode">Drawn map</button></div></div>
   <div class="mapwrap"><div class="lmap" id="lmap"></div>${side}</div></div>`;
  const L=window.L; LMAP=L.map('lmap',{zoomControl:true,attributionControl:true,preferCanvas:true}); LMAP.setView([35.68,139.75],11,{animate:false}); const dark=isDark();
  if(LIVE_OK) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors',className:dark?'tiles-dark':'',opacity:BASEMAP?0.85:1}).addTo(LMAP); else { LMAP.getContainer().style.background=dark?'#171c26':'#f3f0e8'; LMAP.attributionControl.addAttribution('Map data &copy; OpenStreetMap contributors'); }
  if(!BASEMAP&&!BASEMAP_TRIED) loadBasemap(); try{ addVectorBasemap(LMAP,dark); }catch(e){ console.warn('basemap',e); }
  const group=L.featureGroup().addTo(LMAP);
  const seen=new Set(route.map(p=>p.id));
  pts.forEach(p=>{ const onRoute=seen.has(p.id); const m=L.circleMarker([p.lat,p.lng],{radius:day?(onRoute?9:4):7,color:'#fff',weight:1.5,fillColor:p.src==='you'?'#d8482a':'#1f8a9c',fillOpacity:day&&!onRoute?.45:.95}).addTo(group); const pp=placePhoto(p.id);
    m.bindPopup(`${pp?`<img src="${esc(thumb(pp))}" alt="">`:''}<div class="pn">${esc(p.name)}</div><div>${p.hours?esc(p.hours):''}</div>${p.best?`<div class="muted">${esc(p.best)}</div>`:''}<div style="margin-top:6px"><a href="#" data-place="${p.id}">Details</a> · <a target="_blank" rel="noopener" href="${esc(mapsLink(p))}">Google Maps</a></div>`); });
  if(route.length){ const k=(MAPV.trail==null)?route.length:Math.max(1,Math.min(route.length,MAPV.trail)); const ll=route.map(p=>[p.lat,p.lng]);
    L.polyline(ll,{color:dark?'#fff':'#171a21',weight:2,dashArray:'3 7',opacity:.3}).addTo(group);
    if(k>1) L.polyline(ll.slice(0,k),{color:dark?'#ffb36b':'#d8482a',weight:4,opacity:.95}).addTo(group);
    route.forEach((p,i)=>{ const on=i<k; L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:`<div style="width:${on?24:18}px;height:${on?24:18}px;border-radius:50%;background:${on?(p.src==='you'?'#d8482a':'#1f8a9c'):'#9aa3b2'};opacity:${on?1:.55};color:#fff;font:700 11px/${on?24:18}px ${'var(--mono)'};text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i+1}</div>`,iconSize:[on?24:18,on?24:18],iconAnchor:[on?12:9,on?12:9]})}).addTo(group).bindTooltip(p.name.split(' (')[0]); });
    const cur=route[k-1]; L.circleMarker([cur.lat,cur.lng],{radius:14,color:dark?'#ffb36b':'#d8482a',weight:3,fill:false,className:'pulse'}).addTo(group); }
  if(MAPV.keepView){ LMAP.setView(MAPV.keepView.center,MAPV.keepView.zoom,{animate:false}); MAPV.keepView=null; if(MAPV.trail!=null&&route.length){ const cur=route[Math.max(1,Math.min(route.length,MAPV.trail))-1]; if(!LMAP.getBounds().contains([cur.lat,cur.lng])) LMAP.panTo([cur.lat,cur.lng]); } }
  else { const core=(route.length?route:pts).filter(p=>p.lat>34&&p.lat<37.6&&p.lng>134.5&&p.lng<140.6); const b=L.latLngBounds(core.map(p=>[p.lat,p.lng])); if(core.length&&b.isValid()) LMAP.fitBounds(b.pad(0.08),{maxZoom:14}); else LMAP.setView([35.68,139.75],11); }
  $('#mapday').addEventListener('change',e=>{MAPV.day=Number(e.target.value); MAPV.trail=null; stopTrail(); renderMap();});
  $('#mapmode').addEventListener('click',()=>{MAPV.live=false; stopTrail(); renderMap();});
  const tr=$('#trail'); if(tr){ tr.addEventListener('input',e=>{ stopTrail(); MAPV.trail=Number(e.target.value); updateTrail(day,route); }); }
  const tp=$('#trailplay'); if(tp){ tp.addEventListener('click',()=>{ if(TRAIL_TIMER){ stopTrail(); tp.textContent='Play the day'; return; } MAPV.trail=(MAPV.trail==null||MAPV.trail>=route.length)?1:MAPV.trail; updateTrail(day,route); tp.textContent='Pause'; TRAIL_TIMER=setInterval(()=>{ if(MAPV.trail>=route.length){ stopTrail(); const b=$('#trailplay'); if(b) b.textContent='Play the day'; return; } MAPV.trail++; updateTrail(day,route); },1400); }); }
  $('#locate').addEventListener('click',()=>{ if(!navigator.geolocation){toast('No location here');return;} navigator.geolocation.getCurrentPosition(pos=>{const ll=[pos.coords.latitude,pos.coords.longitude]; L.circleMarker(ll,{radius:9,color:'#fff',weight:2,fillColor:'#7c3aed',fillOpacity:1}).addTo(LMAP).bindPopup('You are here').openPopup(); LMAP.setView(ll,15);},()=>toast('Location not available'),{enableHighAccuracy:true,timeout:8000}); }); }
function trailUI(day,route){ const n=route.length; const k=(MAPV.trail==null)?n:Math.max(1,Math.min(n,MAPV.trail)); const cur=route[k-1]; const playing=!!TRAIL_TIMER;
  return `<div class="trail"><div class="h-row"><button class="btn small" id="trailplay">${playing?'Pause':'Play the day'}</button><span class="mono small">${k}/${n} · ${esc(cur?cur.t:'')}</span></div><input type="range" id="trail" min="1" max="${n}" value="${k}" aria-label="Day trail"><div class="small"><b>${esc(cur?cur.name:'')}</b>${cur&&cur.travel?` <span class="muted">· ${esc(cur.travel)}</span>`:''}</div></div>`; }
function stopTrail(){ if(TRAIL_TIMER){ clearInterval(TRAIL_TIMER); TRAIL_TIMER=null; } }
function updateTrail(day,route){ if(!LMAP) return; const center=LMAP.getCenter(), zoom=LMAP.getZoom(); MAPV.keepView={center,zoom}; renderMap(); }
function dayHops(day,route){ let rows='', totalKm=0, totalMin=0; route.forEach((p,i)=>{ let d=''; if(i>0){const km=hav(route[i-1],p); const e=estHop(km,day.drive); totalKm+=km; totalMin+=e.min; d=`${km<10?km.toFixed(1):Math.round(km)} km · ~${e.min} min ${e.mode}`;} rows+=`<div class="hop"><div class="n">${i+1}</div><div><button class="pl link" style="border:0;background:none;padding:0;cursor:pointer;text-align:left" data-place="${p.id}">${esc(p.name)}</button><div class="muted small">${esc(p.t)}${p.travel?' · '+esc(p.travel):''}</div></div><div class="d">${d}</div></div>`; });
  const k=(MAPV.trail==null)?route.length:Math.max(1,Math.min(route.length,MAPV.trail));
  return `<div class="card"><span class="eyebrow">Day ${day.n} trail · ${route.length} stops</span>${route.length?trailUI(day,route):''}<p class="small muted">Drag the slider to walk the day; numbered pins light up as you go. Straight-line distance and a rough time; the arrow text is the real route.</p><div class="hops">${rows.replace(/<div class="hop">/g,(m,off)=>m)}</div><p class="small mono muted">Σ ${Math.round(totalKm)} km · ~${Math.round(totalMin/60*10)/10} h moving</p></div>`; }
function pointsPanel(pts){ const you=pts.filter(p=>p.src==='you'), pk=pts.filter(p=>p.src!=='you'); return `<div class="card"><span class="eyebrow">${pts.length} places</span><p class="small muted">Tap a pin or a name. Pick a day above to draw its route.</p><div class="chips">${you.map(p=>`<button class="chip you pl" style="border:0;cursor:pointer" data-place="${p.id}">${esc(p.name.split(' (')[0])}</button>`).join('')}</div><div class="chips" style="margin-top:8px">${pk.map(p=>`<button class="chip pick pl" style="border:0;cursor:pointer" data-place="${p.id}">${esc(p.name.split(' (')[0])}</button>`).join('')}</div></div>`; }
function project(b,W,H,pad){const [minLat,minLng,maxLat,maxLng]=b;const cos=Math.cos((minLat+maxLat)/2*Math.PI/180);const sc=Math.min((W-2*pad)/((maxLng-minLng)*cos),(H-2*pad)/(maxLat-minLat));const ox=(W-(maxLng-minLng)*cos*sc)/2, oy=(H-(maxLat-minLat)*sc)/2;return (lat,lng)=>[ox+(lng-minLng)*cos*sc, oy+(maxLat-lat)*sc];}
function inBox(p,b){return p.lat>=b[0]&&p.lat<=b[2]&&p.lng>=b[1]&&p.lng<=b[3];}
function renderMap(){ const v=$('#view-map'); if(LMAP){try{LMAP.remove();}catch(e){} LMAP=null;}
  if(MAPV.live!==false && window.L){ const day0=MAPV.day?DAYS.find(d=>d.n===MAPV.day):null; const route0=day0?routeOf(day0):[]; const all=Object.values(ALL).filter(p=>p.lat&&!p.dup&&p.lat>20&&p.lng>120); renderLiveMap(day0, route0, all); return; }
  const W=800,H=560,pad=18; const box=VIEWS[MAPV.view].b; const pr=project(box,W,H,pad);
  const coast=window.JAPAN_OUTLINE.map(r=>'M'+r.map(([x,y])=>pr(y,x).map(n=>n.toFixed(1)).join(',')).join('L')+'Z').join('');
  const day=MAPV.day?DAYS.find(d=>d.n===MAPV.day):null;
  const route=day?routeOf(day):[]; const seen=new Set(route.map(p=>p.id));
  const pts=Object.values(ALL).filter(p=>p.lat&&inBox(p,box)&&!(p.dup));
  const circles=pts.map(p=>{const [x,y]=pr(p.lat,p.lng); const onRoute=seen.has(p.id); const r=day?(onRoute?0:3.2):5; if(!r) return ''; return `<circle class="pt" data-place="${p.id}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="var(--${p.src==='you'?'you':'pick'})" fill-opacity="${day?0.45:1}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(p.name)}</title></circle>`;}).join('');
  let routeSvg='';
  if(route.length){ const xy=route.map(p=>pr(p.lat,p.lng)); routeSvg=`<polyline points="${xy.map(c=>c.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>`+route.map((p,i)=>{const [x,y]=xy[i]; const inView=inBox(p,box); if(!inView) return ''; return `<g class="pt" data-place="${p.id}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="var(--${p.src==='you'?'you':'pick'})" stroke="var(--surface)" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--surface)" font-family="var(--mono)">${i+1}</text><text x="${(x+13).toFixed(1)}" y="${(y+4).toFixed(1)}" font-size="11" fill="var(--fg)" stroke="var(--surface)" stroke-width="3" paint-order="stroke" font-family="var(--body)">${esc(p.name.split(' (')[0].slice(0,26))}</text><title>${esc(p.name)}</title></g>`;}).join(''); }
  const off=route.filter(p=>!inBox(p,box)).length;
  const labels=!day&&MAPV.view==='japan'?[['Tokyo',35.68,139.76],['Kyoto',35.01,135.76],['Osaka',34.69,135.5],['Nagoya',35.17,136.9],['Fuji',35.36,138.73],['Kanazawa',36.56,136.65],['Nikko',36.75,139.6]].map(([n,la,lo])=>{const [x,y]=pr(la,lo);return `<text x="${x+6}" y="${y+4}" font-size="11" fill="var(--muted)" font-family="var(--mono)">${n}</text>`;}).join(''):'';
  const svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of saved places"><rect width="${W}" height="${H}" fill="var(--water)"/><path d="${coast}" fill="var(--land)" stroke="var(--coast)" stroke-width="1" fill-rule="evenodd"/>${labels}${circles}${routeSvg}</svg><div class="tip" id="maptip"></div>`;
  // hops
  let side='';
  if(day){ let rows='', totalKm=0, totalMin=0; route.forEach((p,i)=>{ let d=''; if(i>0){const km=hav(route[i-1],p); const e=estHop(km,day.drive); totalKm+=km; totalMin+=e.min; d=`${km<10?km.toFixed(1):Math.round(km)} km · ~${e.min} min ${e.mode}`;} rows+=`<div class="hop"><div class="n">${i+1}</div><div><button class="pl link" style="border:0;background:none;padding:0;cursor:pointer;text-align:left" data-place="${p.id}">${esc(p.name)}</button><div class="muted small">${esc(p.t)}${p.travel?' · '+esc(p.travel):''}</div></div><div class="d">${d}</div></div>`; });
    side=`<div class="card"><span class="eyebrow">Day ${day.n} route · ${route.length} stops</span><p class="small muted">Straight-line distance and a rough time; the arrow text is the real route. ${off?off+' stop(s) are outside this map view.':''}</p><div class="hops">${rows}</div><p class="small mono muted">Σ ${Math.round(totalKm)} km · ~${Math.round(totalMin/60*10)/10} h moving</p></div>`; }
  else { const you=pts.filter(p=>p.src==='you'), pk=pts.filter(p=>p.src!=='you'); side=`<div class="card"><span class="eyebrow">${pts.length} places in view</span><p class="small muted">Tap a dot or a name. Pick a day above to draw its route.</p><div class="chips">${you.map(p=>`<button class="chip you pl" style="border:0;cursor:pointer" data-place="${p.id}">${esc(p.name.split(' (')[0])}</button>`).join('')}</div><div class="chips" style="margin-top:8px">${pk.map(p=>`<button class="chip pick pl" style="border:0;cursor:pointer" data-place="${p.id}">${esc(p.name.split(' (')[0])}</button>`).join('')}</div></div>`; }
  v.innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Map graphs</span><div class="h-row"><span class="sticker lg">${ICON('fuji')}</span><h1>Where everything is</h1></div><p class="muted">Hand-drawn from your saved coordinates. For live navigation every place links out to Google Maps.</p>
   <div class="filters"><div class="tiers">${Object.entries(VIEWS).map(([k,o])=>`<button class="btn small" data-view="${k}" aria-pressed="${MAPV.view===k}">${o.label}</button>`).join('')}</div>
   <select id="mapday" aria-label="Day route"><option value="0">All places, no route</option>${DAYS.map(d=>`<option value="${d.n}" ${MAPV.day===d.n?'selected':''}>Day ${d.n} · ${d.dow} ${d.date.slice(5)} · ${esc(d.title)}</option>`).join('')}</select></div>
   <div class="legend"><span><i style="background:var(--you)"></i>Your lists</span><span><i style="background:var(--pick)"></i>Claude picks</span><span>numbered = today’s route order</span>${window.L?'<button class="btn small" id="golive">Interactive map</button>':''}</div></div>
   <div class="mapwrap"><div class="mapbox">${svg}</div>${side}</div></div>`;
  const tip=$('#maptip'), boxEl=v.querySelector('.mapbox');
  v.querySelectorAll('.pt').forEach(el=>{ el.addEventListener('mousemove',e=>{ const p=ALL[el.dataset.place]; const r=boxEl.getBoundingClientRect(); tip.textContent=p.name; tip.style.left=(e.clientX-r.left)+'px'; tip.style.top=(e.clientY-r.top)+'px'; tip.classList.add('on'); }); el.addEventListener('mouseleave',()=>tip.classList.remove('on')); el.style.cursor='pointer'; });
  v.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{MAPV.view=b.dataset.view; renderMap();}));
  const gl=$('#golive'); if(gl) gl.addEventListener('click',()=>{MAPV.live=true; renderMap();});
  $('#mapday').addEventListener('change',e=>{MAPV.day=Number(e.target.value); if(MAPV.day){const d=DAYS.find(x=>x.n===MAPV.day); MAPV.view=d.n<=2||d.n>=8?'tokyo':(d.n<=4?'fuji':'kansai'); if(d.n===5) MAPV.view='kansai';} renderMap();}); }

// ---------- places ----------
const FILTER={q:'',list:'all',sched:'all'};
function renderPlaces(){ const v=$('#view-places'); const lists=[...new Set(PLACES.map(p=>p.list))]; lists.push('Claude pick');
  const items=Object.values(ALL).filter(p=>!p.dup).filter(p=>FILTER.list==='all'||p.list===FILTER.list).filter(p=>FILTER.sched==='all'||(FILTER.sched==='yes'?!!dayOf(p):!dayOf(p))).filter(p=>{ if(!FILTER.q) return true; const q=FILTER.q.toLowerCase(); return [p.name,p.area,p.cat,p.note,p.use,p.address].join(' ').toLowerCase().includes(q); });
  v.innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">${PLACES.length} saved places across 7 lists · ${SUGG.length} suggestions</span><div class="h-row"><span class="sticker lg">${ICON('lantern')}</span><h1>Every place, with hours and the right time to go</h1></div>
   <div class="filters"><input id="pq" type="search" placeholder="Search name, area, note…" value="${esc(FILTER.q)}"><select id="plist"><option value="all">All lists</option>${lists.map(l=>`<option ${FILTER.list===l?'selected':''}>${esc(l)}</option>`).join('')}</select><select id="psched"><option value="all" ${FILTER.sched==='all'?'selected':''}>Scheduled or not</option><option value="yes" ${FILTER.sched==='yes'?'selected':''}>In the plan</option><option value="no" ${FILTER.sched==='no'?'selected':''}>Not in the plan</option></select></div></div>
   <div class="grid2">${items.map(placeCard).join('')||'<p class="muted">Nothing matches.</p>'}</div></div>`;
  let pqT=null; $('#pq').addEventListener('input',e=>{clearTimeout(pqT); pqT=setTimeout(()=>{FILTER.q=e.target.value; const g=v.querySelector('.grid2'); const items2=Object.values(ALL).filter(p=>!p.dup).filter(p=>FILTER.list==='all'||p.list===FILTER.list).filter(p=>FILTER.sched==='all'||(FILTER.sched==='yes'?!!dayOf(p):!dayOf(p))).filter(p=>{const q=FILTER.q.toLowerCase(); return !q||[p.name,p.area,p.cat,p.note,p.use,p.address].join(' ').toLowerCase().includes(q);}); g.innerHTML=items2.map(placeCard).join('')||'<p class="muted">Nothing matches.</p>';},120);});
  $('#plist').addEventListener('change',e=>{FILTER.list=e.target.value; renderPlaces();});
  $('#psched').addEventListener('change',e=>{FILTER.sched=e.target.value; renderPlaces();}); }
function dayOf(p){const d=DAYS.find(d=>{const {act}=effective(d); return d.stops.some((s,i)=>s.ref===p.id&&act[i]);}); return d?d.n:0;}
function placeCard(p){ const dn=dayOf(p); const pp=placePhoto(p.id); return `<div class="card place">${pp?`<img class="thumb" src="${esc(thumb(pp))}" alt="" loading="lazy" decoding="async">`:''}<div class="head">${ICON(catIcon(p))}<b><button class="pl" style="border:0;background:none;padding:0;font:inherit;font-weight:600;color:inherit;cursor:pointer;text-align:left" data-place="${p.id}">${esc(p.name)}</button></b>${srcChip(p)}${dn?`<a class="chip day" href="#day${dn}" data-go="days" data-day="${dn}">Day ${dn}</a>`:'<span class="chip tag">not scheduled</span>'}</div>
  <div class="rating">${p.rating?`★ ${p.rating} · ${Number(p.reviews||0).toLocaleString('en-US')}`:''} ${p.cat?'· '+esc(p.cat):''} ${p.area?'· '+esc(p.area):''}</div>
  <dl class="kv">${p.hours?`<dt>Hours</dt><dd>${esc(p.hours)}</dd>`:''}${p.best?`<dt>Best</dt><dd>${esc(p.best)}</dd>`:''}${p.use?`<dt>Why</dt><dd>${esc(p.use)}</dd>`:''}${p.note?`<dt>Your note</dt><dd>“${esc(p.note)}”</dd>`:''}${p.tip?`<dt>Tip</dt><dd>${esc(p.tip)}</dd>`:''}</dl>
  <div><a class="link small" target="_blank" rel="noopener" href="${esc(mapsLink(p))}">Google Maps ↗</a></div></div>`; }

// ---------- shop & eat ----------
function refLinks(refs){return (refs||[]).map(r=>ALL[r]?`<button class="chip ${ALL[r].src==='you'?'you':'pick'} pl" style="border:0;cursor:pointer" data-place="${r}">${esc(ALL[r].name.split(' (')[0])}</button>`:'').join(' ');}
function listRows(arr,prefix){return arr.map((it,i)=>{const id=`${prefix}:${i}`; const d=isChecked(id); return `<div class="check${d?' done':''}"><input type="checkbox" id="c-${id}" data-check="${id}" ${d?'checked':''}><label for="c-${id}"><b>${esc(it.item)}</b> <span class="muted small">· ${esc(it.where)} · ${esc(it.est)}${it.day?` · Day ${it.day}`:''}</span>${it.note?`<div class="small muted">${esc(it.note)}</div>`:''}<div class="chips" style="margin-top:4px">${refLinks(it.refs)}</div></label></div>`;}).join('');}
function renderShop(){ const sdone=window.SHOPPING.filter((_,i)=>isChecked('shop:'+i)).length, fdone=window.FOOD.filter((_,i)=>isChecked('food:'+i)).length;
  $('#view-shop').innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Your list, mapped to shops and days</span><div class="h-row"><span class="sticker lg">${ICON('bag')}</span><span class="sticker lg">${ICON('ramen')}</span><h1>Shopping and eating</h1></div><p class="muted">Tick as you buy. The 7 kg cabin limit on the way home is the real constraint; heavy things go in the 25 kg checked bag.</p></div>
   <div class="card"><div class="day-head"><h2>Things to get</h2><span class="muted mono small">${sdone}/${window.SHOPPING.length}</span></div><div class="progress"><i style="width:${sdone/window.SHOPPING.length*100}%"></i></div>${listRows(window.SHOPPING,'shop')}</div>
   <div class="card"><div class="day-head"><h2>Things to eat</h2><span class="muted mono small">${fdone}/${window.FOOD.length}</span></div><div class="progress"><i style="width:${fdone/window.FOOD.length*100}%"></i></div>${listRows(window.FOOD,'food')}</div></div>`; }

// ---------- checklist ----------
function renderCheck(){ $('#view-check').innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Before, during, after</span><div class="h-row"><span class="sticker lg">${ICON('daruma')}</span><h1>Checklist</h1></div></div>${window.CHECKLISTS.map(g=>{const done=g.items.filter(i=>isChecked(i.id)).length; const gi=['sparkle','lantern','robot','bag','daruma'][window.CHECKLISTS.indexOf(g)]||'onigiri'; return `<div class="card"><div class="day-head"><span class="sticker">${ICON(gi)}</span><h2>${esc(g.group)}</h2><span class="muted mono small">${done}/${g.items.length}</span></div><div class="progress"><i style="width:${done/g.items.length*100}%"></i></div>${g.items.map(i=>`<div class="check${isChecked(i.id)?' done':''}"><input type="checkbox" id="c-${i.id}" data-check="${i.id}" ${isChecked(i.id)?'checked':''}><label for="c-${i.id}">${esc(i.text)}${i.ref&&ALL[i.ref]?` <button class="chip ${ALL[i.ref].src==='you'?'you':'pick'} pl" style="border:0;cursor:pointer" data-place="${i.ref}">${esc(ALL[i.ref].name.split(' (')[0])}</button>`:''}</label></div>`).join('')}</div>`;}).join('')}</div>`; }

// ---------- budget ----------
const SLOT=['s1','s2','s3','s4','s5','s6','s7','s8'];
function planFor(c){const o=STATE.budget.over[c.key]; return (o!=null&&!isNaN(o))?Number(o):c[STATE.budget.tier];}
function spentFor(key){return STATE.expenses.filter(e=>e.cat===key).reduce((a,e)=>a+Number(e.amt||0),0);}
function renderBudget(){ const B=window.BUDGET, rate=STATE.budget.rate; const v=$('#view-budget');
  const tot=k=>B.cats.reduce((a,c)=>a+c[k],0); const adj=DAYS.reduce((a,d)=>a+schedule(d).delta,0); const plan=B.cats.reduce((a,c)=>a+planFor(c),0)+adj; const spent=STATE.expenses.reduce((a,e)=>a+Number(e.amt||0),0);
  const rows=B.cats.map((c,i)=>`<tr><td><span class="swatch" style="background:var(--${SLOT[i]})"></span>${esc(c.label)}<div class="small muted">${esc(c.note)}</div></td><td class="num">${fmtY(c.lean)}</td><td class="num">${fmtY(c.mid)}</td><td class="num">${fmtY(c.splurge)}</td><td class="num"><input class="amt" type="number" inputmode="numeric" data-over="${c.key}" value="${planFor(c)}"></td><td class="num" data-spent="${c.key}">${fmtY(spentFor(c.key))}</td></tr>`).join('');
  v.innerHTML=`<div class="stack"><div class="card flat"><span class="eyebrow">Flights already paid · ₹2–4 lakh on the ground</span><div class="h-row"><span class="sticker lg">${ICON('yen')}</span><h1>Budget</h1></div><p class="muted">Three tiers in yen, converted at your rate. Edit any cell to make it your plan; log spends below and the chart tracks them.</p>
   <div class="filters"><div class="tiers">${['lean','mid','splurge'].map(t=>`<button class="btn small" data-tier="${t}" aria-pressed="${STATE.budget.tier===t}">${t==='lean'?'Lean ≈ ₹2L':t==='mid'?'Mid ≈ ₹3L':'Splurge ≈ ₹4L'}</button>`).join('')}</div><label class="small muted">₹ per ¥ <input class="amt" id="rate" type="number" step="0.001" value="${rate}"></label><button class="btn small" id="resetover">Reset edits</button></div></div>
   <div class="totals"><div class="tile"><span class="sticker">${ICON('yen')}</span><div><div class="v" id="t-plan">${fmtY(plan)}</div><div class="l">your plan${adj?` · incl. ${adj>0?'+':'−'}${fmtY(Math.abs(adj))} itinerary changes`:''}</div></div></div><div class="tile"><span class="sticker">${ICON('sparkle')}</span><div><div class="v" id="t-planr">${fmtR(plan*rate)}</div><div class="l">in rupees</div></div></div><div class="tile"><span class="sticker">${ICON('bag')}</span><div><div class="v" id="t-spent">${fmtY(spent)}</div><div class="l">spent so far · ${fmtR(spent*rate)}</div></div></div><div class="tile"><span class="sticker">${ICON('daruma')}</span><div><div class="v" id="t-left">${fmtY(plan-spent)}</div><div class="l">left</div></div></div></div>
   <div class="chart" id="chart"></div>
   <div class="card"><div class="tablewrap"><table><thead><tr><th>Category</th><th class="num">Lean</th><th class="num">Mid</th><th class="num">Splurge</th><th class="num">Your plan</th><th class="num">Spent</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Total</th><th class="num">${fmtY(tot('lean'))}<br><span class="muted">${fmtR(tot('lean')*rate)}</span></th><th class="num">${fmtY(tot('mid'))}<br><span class="muted">${fmtR(tot('mid')*rate)}</span></th><th class="num">${fmtY(tot('splurge'))}<br><span class="muted">${fmtR(tot('splurge')*rate)}</span></th><th class="num" id="f-plan">${fmtY(plan)}</th><th class="num" id="f-spent">${fmtY(spent)}</th></tr></tfoot></table></div></div>
   <div class="card"><h2>Spend log</h2><form class="exp" id="expform"><input name="desc" placeholder="What (e.g. Fujiya X-E3)" required><input name="amt" type="number" inputmode="numeric" placeholder="¥ amount" required min="1"><select name="cat">${B.cats.map(c=>`<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select><input name="date" type="date" value="${todayJST()}"><button class="btn primary full" type="submit">Add spend</button></form><div id="explist">${expRows()}</div></div></div>`;
  drawChart();
  v.querySelectorAll('[data-tier]').forEach(b=>b.addEventListener('click',()=>{ if(!canEdit()){ requireEdit(()=>{}); return; }STATE.budget.tier=b.dataset.tier; STATE.budget.over={}; Store.save(); renderBudget();}));
  $('#rate').addEventListener('change',e=>{const r=Number(e.target.value); if(r>0){STATE.budget.rate=r; Store.save(); renderBudget();}});
  $('#resetover').addEventListener('click',()=>{STATE.budget.over={}; Store.save(); renderBudget();});
  v.querySelectorAll('[data-over]').forEach(inp=>inp.addEventListener('input',e=>{ if(!canEdit()){ e.target.value=planFor(B.cats.find(c=>c.key===inp.dataset.over)); requireEdit(()=>{}); return; }const val=e.target.value; if(val==='') delete STATE.budget.over[inp.dataset.over]; else STATE.budget.over[inp.dataset.over]=Number(val); Store.save(); updateTotals();}));
  $('#expform').addEventListener('submit',e=>{e.preventDefault(); if(!canEdit()){ requireEdit(()=>{}); return; } const f=new FormData(e.target); STATE.expenses.push({id:Date.now().toString(36),desc:String(f.get('desc')).slice(0,80),amt:Number(f.get('amt')),cat:String(f.get('cat')),date:String(f.get('date')||todayJST())}); Store.save(); renderBudget(); toast('Logged');});
  v.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ if(!canEdit()){ requireEdit(()=>{}); return; }STATE.expenses=STATE.expenses.filter(x=>x.id!==b.dataset.del); Store.save(); renderBudget();})); }
function expRows(){ if(!STATE.expenses.length) return `<div class="empty"><span class="sticker lg">${ICON('onigiri')}</span><p class="small">No spends yet. The first one is probably a 7-Eleven egg sando.</p></div>`; const B=window.BUDGET; const byDate=STATE.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.id>a.id?1:-1)); return `<div class="tablewrap"><table><thead><tr><th>Date</th><th>What</th><th>Category</th><th class="num">¥</th><th class="num">₹</th><th></th></tr></thead><tbody>${byDate.map(e=>{const c=B.cats.find(c=>c.key===e.cat)||{label:e.cat}; return `<tr><td class="mono">${esc(e.date)}</td><td>${esc(e.desc)}</td><td class="small muted">${esc(c.label)}</td><td class="num">${fmtY(e.amt)}</td><td class="num muted">${fmtR(e.amt*STATE.budget.rate)}</td><td><button class="btn small" data-del="${e.id}" aria-label="Delete">×</button></td></tr>`;}).join('')}</tbody></table></div>`; }
function updateTotals(){ const B=window.BUDGET, rate=STATE.budget.rate; const plan=B.cats.reduce((a,c)=>a+planFor(c),0)+DAYS.reduce((a,d)=>a+schedule(d).delta,0); const spent=STATE.expenses.reduce((a,e)=>a+Number(e.amt||0),0); $('#t-plan').textContent=fmtY(plan); $('#t-planr').textContent=fmtR(plan*rate); $('#t-left').textContent=fmtY(plan-spent); $('#f-plan').textContent=fmtY(plan); drawChart(); }
function drawChart(){ const B=window.BUDGET; const series=[{label:'Lean',vals:B.cats.map(c=>c.lean)},{label:'Mid',vals:B.cats.map(c=>c.mid)},{label:'Splurge',vals:B.cats.map(c=>c.splurge)},{label:'Your plan',vals:B.cats.map(planFor)},{label:'Spent',vals:B.cats.map(c=>spentFor(c.key))}];
  const W=760,rowH=34,left=86,right=118,top=30,H=top+series.length*rowH+36; const max=Math.max(...series.map(s=>s.vals.reduce((a,b)=>a+b,0)),1); const sc=(W-left-right)/max;
  const ticks=[0,200000,400000,600000,800000].filter(t=>t<=max*1.05);
  let g=ticks.map(t=>`<line x1="${(left+t*sc).toFixed(1)}" y1="${top-6}" x2="${(left+t*sc).toFixed(1)}" y2="${H-30}" stroke="var(--grid)"/><text x="${(left+t*sc).toFixed(1)}" y="${H-14}" font-size="10" text-anchor="middle" fill="var(--muted)" font-family="var(--mono)">${t?'¥'+(t/1000)+'k':'¥0'}</text>`).join('');
  series.forEach((s,si)=>{ let x=left; const y=top+si*rowH; const total=s.vals.reduce((a,b)=>a+b,0); g+=`<text x="${left-8}" y="${y+16}" font-size="11" text-anchor="end" fill="var(--fg)" font-family="var(--body)">${s.label}</text>`; s.vals.forEach((val,ci)=>{ const w=val*sc; if(w>0){ g+=`<rect x="${(x+1).toFixed(1)}" y="${y+2}" width="${Math.max(0,w-2).toFixed(1)}" height="${rowH-8}" rx="${ci===s.vals.length-1?3:0}" fill="var(--${SLOT[ci]})"><title>${esc(s.label)} · ${esc(B.cats[ci].label)}: ${fmtY(val)}</title></rect>`; x+=w; } }); if(total>0) g+=`<text x="${(x+6).toFixed(1)}" y="${y+16}" font-size="11" fill="var(--fg)" font-family="var(--mono)">${fmtY(total)}</text>`; });
  const legend=B.cats.map((c,i)=>`<span><i class="swatch" style="background:var(--${SLOT[i]})"></i>${esc(c.label.split(' (')[0])}</span>`).join('');
  $('#chart').innerHTML=`<div class="eyebrow" style="margin-bottom:6px">Yen by category · three tiers, your plan, and what you have spent</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked budget bars">${g}</svg><div class="legend">${legend}</div>`; }

// ---------- guide ----------
function renderGuide(){ const G=window.GUIDE; $('#view-guide').innerHTML=`<div class="stack guide"><div class="card flat"><span class="eyebrow">Sidekick</span><div class="h-row"><span class="sticker lg">${ICON('neko')}</span><h1>Guide</h1></div></div>
  <div class="card"><h3>Flights and bookings</h3><p class="small"><b>Out</b> ${esc(TRIP.flights.out)}</p><p class="small"><b>Back</b> ${esc(TRIP.flights.back)}</p>${(TRIP.booked||[]).map(b=>`<p class="small"><b>Booked</b> ${esc(b)}</p>`).join('')}</div>
  ${G.map(s=>`<div class="card" id="g-${s.id}"><h3>${esc(s.title)}</h3>${s.rows?`<div class="tablewrap"><table><tbody>${s.rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0?'':'muted'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${s.text?`<p class="small">${esc(s.text)}</p>`:''}</div>`).join('')}
  <div class="card"><h3>Fourteen phrases that open doors</h3>${window.PHRASES.map(p=>`<div class="phr"><div class="jp">${esc(p.jp)}</div><div class="ro">${esc(p.romaji)}</div><div class="small muted">${esc(p.en)}</div></div>`).join('')}</div>
  <div class="card"><details><summary><b>Photo credits</b> (tap to expand)</summary><p class="small muted">Photos are from Wikimedia Commons under the licences shown; stickers are drawn for this site.</p><div class="credits">${Object.entries(window.PHOTOS||{}).map(([k,ph])=>`<div>${esc(k.toUpperCase())}: <a target="_blank" rel="noopener" href="${esc(ph.page)}">${esc(ph.title)}</a> · ${esc(ph.artist||'unknown')} · ${esc(ph.lic)}</div>`).join('')}</div></details></div>
  <div class="card"><details><summary><b>Place photo sources</b> (tap to expand)</summary><p class="small muted">Place thumbnails were pulled from the web for personal use; each drawer shows the page it came from.</p><div class="credits">${Object.entries(window.PLACE_PHOTOS||{}).filter(([k,v])=>v).map(([k,v])=>`<div>${esc((ALL[k]||{}).name||k)}: <a target="_blank" rel="noopener" href="${esc(v.page||v.src)}">${esc((v.title||v.page||v.src).slice(0,60))}</a></div>`).join('')}</div></details></div>
  <div class="card"><h3>What this site is</h3><p class="small muted">Built from your 7 Google Maps lists (79 places, with the hours and ratings Maps shows), your notes, and the flights in your visa folder. Everything marked “Claude pick” is a suggestion, not something you saved. Ticks, budget edits and spends are stored with the page and sync between your devices when you are signed in; otherwise they stay in this browser.</p></div></div>`; }

// ---------- events ----------
document.addEventListener('click',e=>{ if(e.target.id==='lockbtn'){ if(canEdit()){ setEdit(false); renderCurrent(); toast('Locked'); } else requireEdit(()=>{renderCurrent(); toast('Editing unlocked on this device');}); return; }
  if(e.target.id==='pwok'){ if($('#pwin').value===EDIT_PW){ setEdit(true); $('#pw').hidden=true; $('#scrim').hidden=true; const f=pendingEdit; pendingEdit=null; if(f) f(); } else { $('#pwerr').hidden=false; } return; }
  if(e.target.id==='pwcancel'){ $('#pw').hidden=true; $('#scrim').hidden=true; pendingEdit=null; return; }
  const sm=e.target.closest('[data-swapmenu]'); if(sm){ requireEdit(()=>{ const [n,i]=sm.dataset.swapmenu.split(':').map(Number); openSwap(n,i,false); }); return; }
  const am=e.target.closest('[data-addmenu]'); if(am){ requireEdit(()=>{ const [n,i]=am.dataset.addmenu.split(':').map(Number); openSwap(n,i,true); }); return; }
  const uc=e.target.closest('[data-usecand]'); if(uc){ applySwap(uc.dataset.usecand); return; }
  const us=e.target.closest('[data-unswap]'); if(us){ const [n,i]=us.dataset.unswap.split(':').map(Number); unswap(n,i); return; }
  const ua=e.target.closest('[data-unadd]'); if(ua){ const [n,i]=ua.dataset.unadd.split(':').map(Number); unadd(n,i); return; }
  const mr=e.target.closest('[data-menurm]'); if(mr){ const [n,i]=mr.dataset.menurm.split(':').map(Number); const d0=DAYS.find(x=>x.n===n); if(i>=d0.stops.length) unadd(n,i); else { toggle(`skip:${n}:${i}`,true); closeDrawer(); renderCurrent(); toast('Removed, day re-timed'); } return; }
  const sw=e.target.closest('[data-swap]'); if(sw){ requireEdit(()=>{ toggle(sw.dataset.swap,!isChecked(sw.dataset.swap)); renderCurrent(); toast(isChecked(sw.dataset.swap)?'Switched':'Reverted'); }); return; }
  const sk=e.target.closest('[data-skip]'); if(sk){ requireEdit(()=>{ toggle(sk.dataset.skip,!isChecked(sk.dataset.skip)); renderCurrent(); toast(isChecked(sk.dataset.skip)?'Skipped':'Restored'); }); return; }
  const mv=e.target.closest('[data-move]'); if(mv){ requireEdit(()=>{ const [dn,pos,dir]=mv.dataset.move.split(':').map(Number); const d=DAYS.find(x=>x.n===dn); const o=orderOf(d); const j=pos+dir; if(j<0||j>=o.length) return; [o[pos],o[j]]=[o[j],o[pos]]; STATE.order[dn]=o; Store.save(); renderCurrent(); }); return; }
  const rs=e.target.closest('[data-reset]'); if(rs){ requireEdit(()=>{ const dn=Number(rs.dataset.reset); delete STATE.order[dn]; if(STATE.edits) delete STATE.edits[String(dn)]; Object.keys(STATE.checks).forEach(k=>{ if(k.startsWith(`swap:${dn}:`)||k.startsWith(`skip:${dn}:`)) delete STATE.checks[k]; }); Store.save(); renderCurrent(); toast('Day reset'); }); return; }
  const t=e.target.closest('[data-place],[data-go],[data-tab],#drawer-close,#scrim'); if(!t) return;
  if(t.id==='drawer-close'||t.id==='scrim'){closeDrawer();return;}
  if(t.dataset.place){e.preventDefault(); openPlace(t.dataset.place); return;}
  if(t.dataset.tab){show(t.dataset.tab); return;}
  if(t.dataset.go){e.preventDefault(); closeDrawer(); if(t.dataset.mapday){MAPV.day=Number(t.dataset.mapday); const d=DAYS.find(x=>x.n===MAPV.day); MAPV.view=d.n<=2||d.n>=8?'tokyo':(d.n<=4?'fuji':'kansai');} show(t.dataset.go,{day:t.dataset.day?Number(t.dataset.day):0}); } });
document.addEventListener('change',e=>{ const c=e.target.closest('[data-check]'); if(!c) return; if(!canEdit()){ c.checked=!c.checked; requireEdit(()=>{ toggle(c.dataset.check,!isChecked(c.dataset.check)); renderCurrent(); }); return; } toggle(c.dataset.check,c.checked); const row=c.closest('.check,.stop'); if(row) row.classList.toggle('done',c.checked); if(current==='check'||current==='shop') renderCurrent(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeDrawer(); $('#pw').hidden=true; } if(e.key==='Enter'&&e.target.id==='pwin'){ $('#pwok').click(); } });

// ---------- boot ----------
function boot(){ $('#tabs').innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}" aria-selected="false">${ICON(TAB_ICON[k])}<span>${l}</span></button>`).join(''); const h=(location.hash||'').replace('#',''); const m=h.match(/^day(\d+)$/); if(m){ current='days'; } else if(TABS.some(t=>t[0]===h)) current=h; show(current, m?{day:Number(m[1])}:undefined); Store.init(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
