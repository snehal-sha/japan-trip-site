// Live forecast on each day card. Fetches Open-Meteo from the browser (public coordinates only),
// caches for 45 min, and writes a "call" for the weather switches. Fails silently where fetch is blocked.
const WX_P={tokyo:[35.68,139.76,'Tokyo'],fuji:[35.46,138.60,'Fuji lakes'],ito:[34.97,139.10,'Ito coast'],hakone:[35.20,139.02,'Hakone'],kyoto:[35.01,135.77,'Kyoto'],mitarai:[34.25,135.85,'Mitarai Valley'],nara:[34.69,135.84,'Nara']};
const WX_DAY={1:['tokyo'],2:['tokyo'],3:['hakone','ito'],4:['ito','hakone','fuji'],5:['kyoto'],6:['mitarai','nara'],7:['kyoto','fuji'],8:['tokyo'],9:['tokyo'],10:['tokyo']};
const WX_M=['ecmwf_ifs025','gfs_seamless','jma_seamless'];
let WX=null, WX_BUSY=false, WX_FAIL=false;
try{ const c=JSON.parse(localStorage.getItem('jt-wx')||'null'); if(c&&c.t&&c.days) WX=c; }catch(e){}
function wxMed(a){ const s=a.slice().sort((x,y)=>x-y); const n=s.length; return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):null; }
function wxSum(key,date){ const r=WX&&WX.days[date]&&WX.days[date][key]; if(!r) return null;
  const rains=(r.rain||[]).filter(x=>x!=null), clouds=(r.cloud||[]).filter(x=>x!=null); if(!rains.length&&!clouds.length) return null;
  const votes=rains.filter(x=>x>=5).length; const wet=rains.length>=2?votes>=2:votes>=1; const cl=wxMed(clouds);
  const kind=wet?'wet':(cl!=null&&cl>=70?'grey':(cl!=null&&cl<=30?'clear':'part'));
  const lo=rains.length?Math.min(...rains):0, hi=rains.length?Math.max(...rains):0;
  const rainTxt=hi<1?'dry':(Math.round(lo)===Math.round(hi)?`${Math.round(hi)} mm`:`${Math.round(lo)}–${Math.round(hi)} mm`);
  const spread=clouds.length?Math.max(...clouds)-Math.min(...clouds):0; const agree=(votes===0||votes===rains.length)&&spread<=40;
  return {wet,kind,cl,rainTxt,agree,lone:!wet&&votes===1,tmin:r.tmin,tmax:r.tmax,n:Math.max(rains.length,clouds.length)}; }
function wxCall(d){ const S=(k,dt)=>wxSum(k,dt)||{}; const D=n=>DAYS[n-1].date; const wet=(k,n)=>!!S(k,D(n)).wet;
  if(d.n===2){ const s=S('tokyo',d.date); if(!s.kind) return ''; return (s.wet||s.kind==='grey')?'Use the grey-day line: a short garden visit, and skip the sky bar if the cloud sits low.':'Fine: the garden and the sky bar are both on.'; }
  if(d.n===3||d.n===4){ const w3=wet('hakone',3)||wet('ito',3), w4=wet('fuji',4)||wet('hakone',4); if(!S('hakone',D(3)).kind) return '';
    if(w3&&!w4) return d.n===3?'Wet, as planned for: the museum, the tea house, the coast road and Tokaikan. The views are tomorrow.':'The clear drive day, as planned: every view is on it.';
    if(w3&&w4) return d.n===3?'Both drive days look wet: today as planned.':'Wet as well: drive the Turnpike, skip the lakes if Fuji is hidden, and head home early.';
    if(!w3&&w4) return d.n===3?'Today now looks drier than tomorrow: swap back (the line below) and take the Fuji lakes today.':'Wet: if you swapped back, keep it to the tea house, the Turnpike and the expressway home.';
    if(d.n===3) return 'Drier than forecast: as planned, with more time on the museum lawns.'; const c=S('ito',d.date).cl; return 'Drive as planned. Jogasaki sunrise '+(c!=null&&c<=50?'is worth the 06:00 start.':'may be hidden: sleep in if the sky is grey.'); }
  if(d.n===5){ const s=S('kyoto',d.date); if(!s.kind) return ''; return s.wet?'Rain: Enkōji still works from under the roof; pick teamLab for the evening.':'Dry: the garden gets the afternoon light.'; }
  if(d.n===6){ const m=S('mitarai',d.date), n=S('nara',d.date); if(!m.kind) return ''; if(m.wet) return 'Drop the car: cancel the rental by Friday night and use the no-car line.'; return 'Keep the car.'+((n.wet||n.kind==='grey')?' The Nara sunset may have no sky.':''); }
  if(d.n===7){ const k=S('kyoto',d.date), f=S('fuji',d.date); if(!k.kind) return ''; return (k.wet?'Rain suits the moss gardens; carry an umbrella. ':'')+(f.cl!=null?(f.cl<=40&&!f.wet?'Fuji should show from seat E.':'Fuji may be in cloud from the train.'):''); }
  if(d.n===8||d.n===9){ const a=S('tokyo',D(8)), b=S('tokyo',D(9)); if(!a.kind||!b.kind) return ''; let t;
    if((b.wet&&!a.wet)||(b.cl-a.cl>=25)) t='Skytree: Monday evening looks clearer; go about 20:30 after dinner.';
    else if((a.wet&&!b.wet)||(a.cl-b.cl>=25)) t='Skytree: Tuesday evening looks clearer, as planned.'; else t='Skytree: no clear difference yet; Tuesday 17:15 stands.';
    if(d.n===8&&a.wet) t='Rain cancels the antique market: Nakano Broadway instead. '+t; return t; }
  return ''; }
function wxInner(d){ if(!WX) return WX_FAIL?'':'<span class="small muted">Live forecast loads when you are online.</span>';
  const keys=WX_DAY[d.n]||[]; const rows=keys.map(k=>{ const s=wxSum(k,d.date); if(!s) return ''; const L={wet:'Wet',grey:'Grey',clear:'Clear',part:'Part cloud'}[s.kind];
    const temp=(s.tmin!=null&&s.tmax!=null)?` · ${Math.round(s.tmin)}–${Math.round(s.tmax)}°C`:''; const note=s.n<2?'':(s.agree?' · models agree':(s.lone?' · one model has rain':' · models disagree'));
    return `<div class="wxrow"><b>${esc(WX_P[k][2])}</b><span class="wxl ${s.kind}">${L}</span><span>${s.rainTxt}${temp}${note}</span></div>`; }).join('');
  if(!rows) return ''; const lead=daysBetween(todayJST(),d.date); const conf=lead<0?'':(lead<=2?'confidence good':(lead<=6?'confidence fair':'a hint only, '+lead+' days out'));
  const t=new Date(WX.t); const when=t.toLocaleDateString([], {month:'short',day:'numeric'})+' '+t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); const call=wxCall(d);
  return `<div class="wxhead"><span class="eyebrow">Live forecast</span><span class="small muted">updated ${esc(when)}${conf?' · '+conf:''}</span></div>${rows}${call?`<p class="wxcall"><b>Call:</b> ${esc(call)}</p>`:''}`; }
function wxDay(d){ return `<div class="wx" data-wx="${d.n}">${wxInner(d)}</div>`; }
function wxPaint(){ document.querySelectorAll('[data-wx]').forEach(el=>{ const d=DAYS.find(x=>String(x.n)===el.getAttribute('data-wx')); if(d) el.innerHTML=wxInner(d); }); }
async function wxLoad(force){ if(WX_BUSY) return; if(!force&&WX&&Date.now()-WX.t<45*60000) return; WX_BUSY=true;
  try{ const ks=Object.keys(WX_P); const q=`latitude=${ks.map(k=>WX_P[k][0]).join(',')}&longitude=${ks.map(k=>WX_P[k][1]).join(',')}&timezone=Asia%2FTokyo&start_date=${TRIP.start}&end_date=${TRIP.end}`;
    const U='https://api.open-meteo.com/v1/forecast?'+q; const get=async u=>{ const r=await fetch(u); if(!r.ok) throw new Error('wx '+r.status); const j=await r.json(); return Array.isArray(j)?j:[j]; };
    const [A,B]=await Promise.all([get(U+'&daily=weather_code,temperature_2m_max,temperature_2m_min'),get(U+'&daily=precipitation_sum,cloud_cover_mean&models='+WX_M.join(','))]);
    const days={}; ks.forEach((k,i)=>{ const a=A[i].daily, b=B[i].daily; a.time.forEach((dt,j)=>{ (days[dt]=days[dt]||{})[k]={code:a.weather_code[j],tmin:a.temperature_2m_min[j],tmax:a.temperature_2m_max[j],
      rain:WX_M.map(m=>(b['precipitation_sum_'+m]||[])[j]),cloud:WX_M.map(m=>(b['cloud_cover_mean_'+m]||[])[j])}; }); });
    WX={t:Date.now(),days}; WX_FAIL=false; try{ localStorage.setItem('jt-wx',JSON.stringify(WX)); }catch(e){} }
  catch(e){ WX_FAIL=true; }
  WX_BUSY=false; wxPaint(); }
setTimeout(()=>wxLoad(),0);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) wxLoad(); });
