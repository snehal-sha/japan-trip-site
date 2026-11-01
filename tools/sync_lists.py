#!/usr/bin/env python3
"""Pull Snehal's shared Google Maps lists and place details into places2.json.
Usage: python3 sync_lists.py [--no-details]   (run from the scratchpad build dir)"""
import json, os, re, sys, time, urllib.request, urllib.parse
UA={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9'}
LISTS=['-KWKUDxqELa51Mg6vznfVA','RG0rvxBSgNzCqR8VbVErXxA-pF-oHw','lW5qpaKnPboqf9uuLRrX9DwLRR1SBw','H8B-P70iYQtGw1IQymfyEFJoFCRTnA','yjCB2AhxvCBEd7fYhVA5ta4Fr9zzgg','7zcxm1VR6f2CVCIyRYPOVg','FtvzUZTQw_sSdKtDX5qzhA']
PB_PLACE='%211m14%211s0x0%3A0x{hex}%213m12%211m3%211d31104.69%212d139.81%213d35.71%212m3%211f0.0%212f0.0%213f0.0%213m2%211i1024%212i768%214f13.1%2112m4%212m3%211i360%212i120%214i8%2113m57%212m2%211i203%212i100%213m2%212i4%215b1%216m6%211m2%211i86%212i86%211m2%211i408%212i240%217m33%211m3%211e1%212b0%213e3%211m3%211e2%212b1%213e2%211m3%211e2%212b0%213e3%211m3%211e8%212b0%213e3%211m3%211e10%212b0%213e3%211m3%211e10%212b1%213e2%211m3%211e10%212b0%213e4%211m3%211e9%212b1%213e2%212b1%219b0%2115m8%211m7%211m2%211m1%211e2%212m2%211i195%212i195%213i20%2114m3%211sTz7naqyLO6SbhvcPvPGryQ0%217e81%2115i10112%2115m108%211m26%2113m9%212b1%213b1%214b1%216i1%218b1%219b1%2114b1%2120b1%2125b1%2118m15%213b1%214b1%215b1%216b1%2113b1%2114b1%2117b1%2121b1%2122b1%2130b1%2132b1%2133m1%211b1%2134b1%2136e2%2110m1%218e3%2111m1%213e1%2117b1%2120m2%211e3%211e6%2124b1%2125b1%2126b1%2127b1%2129b1%2130m1%212b1%2136b1%2137b1%2139m3%212m2%212i1%213i1%2143b1%2152b1%2154m1%211b1%2155b1%2156m1%211b1%2161m2%211m1%211e1%2165m5%213m4%211m3%211m2%211i224%212i298%2172m22%211m8%212b1%215b1%217b1%2112m4%211b1%212b1%214m1%211e1%214b1%218m10%211m6%214m1%211e1%214m1%211e3%214m1%211e4%213sother_user_google_review_posts__and__hotel_and_vr_partner_review_posts%216m1%211e1%219b1%2189b1%2190m2%211m1%211e2%2198m3%211b1%212b1%213b1%21103b1%21113b1%21114m3%211b1%212m1%211b1%21117b1%21122m1%211b1%21126b1%21127b1%21128m1%211b1%2121m0%2122m1%211e81%2130m8%213b1%216m2%211b1%212b1%217m2%211e3%212b1%219b1%2134m5%217b1%2110b1%2114b1%2115m1%211b0%2137i801'
DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40).read().decode('utf-8','replace')
def gjson(url):
    t=get(url); return json.loads(t[t.index('\n')+1:] if t.startswith(")]}'") else t)
def compress(h):
    if not h: return ''
    m={}
    for x in h:
        m[x[0][:3]]=', '.join(r[0] for r in x[3]) if x[3] else 'Closed'
    groups=[]
    for d in DAYS:
        v=m.get(d,'')
        if groups and groups[-1][1]==v: groups[-1][0].append(d)
        else: groups.append([[d],v])
    if len(groups)==1: return 'Daily '+groups[0][1].replace('Open 24 hours','open 24h')
    return '; '.join((g[0][0] if len(g[0])==1 else g[0][0]+'–'+g[0][-1])+' '+g[1].replace('Open 24 hours','open 24h') for g in groups)
def main():
    details=not '--no-details' in sys.argv
    ids=json.load(open('ids.json')) if os.path.exists('ids.json') else {}; old={}
    if os.path.exists('places2.json'):
        for p in json.load(open('places2.json')):
            ids.setdefault(str(p['cid']),p['id']); old[p['id']]=p
    cache=json.load(open('details_cache.json')) if os.path.exists('details_cache.json') else {}
    out=[]; seen=set(); next_n=max([int(i[1:]) for i in ids.values()]+[0])+1
    for lid in LISTS:
        d=gjson('https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=jp&pb=%211m4%211s'+urllib.parse.quote(lid)+'%212e1%213m1%211e1%212e2%213e2%214i500%2128e2%2116b1')
        L=d[0]; title=L[4]; items=L[8] or []
        print(f'{title}: {len(items)} items')
        for it in items:
            try:
                name=it[2]; note=it[3] or ''; loc=it[1] or []
                addr=(loc[2] or loc[4] or '') if len(loc)>4 else ''
                lat,lng=(loc[5][2],loc[5][3]) if len(loc)>5 and loc[5] else (None,None)
                cid=int(loc[6][1]) if len(loc)>6 and loc[6] else None
            except Exception as e:
                print('  skip item',str(e)[:40]); continue
            if cid is None or cid in seen: continue
            seen.add(cid)
            pid=ids.get(str(cid))
            if not pid: pid='p%02d'%next_n; next_n+=1; ids[str(cid)]=pid; print('  NEW',pid,name)
            rec=dict(list=title,name=name,note=note,address=addr,lat=lat,lng=lng,cid=cid,rating=None,reviews=None,category='',hours='',id=pid,cid_hex=hex(cid&0xFFFFFFFFFFFFFFFF),maps='https://maps.google.com/?cid=%d'%(cid&0xFFFFFFFFFFFFFFFF))
            c=cache.get(str(cid))
            if details and (not c or time.time()-c.get('t',0)>7*86400):
                try:
                    dd=gjson('https://www.google.com/maps/preview/place?authuser=0&hl=en&gl=jp&pb='+PB_PLACE.format(hex=rec['cid_hex'][2:]))
                    e=dd[6] or []
                    c=dict(t=time.time(),rating=(e[4] or [None]*9)[7] if len(e)>4 and e[4] else None,reviews=(e[4] or [None]*9)[8] if len(e)>4 and e[4] else None,cats=e[13] if len(e)>13 else None,addr=e[39] if len(e)>39 else None,hours=compress(e[203][0]) if len(e)>203 and e[203] and e[203][0] else '')
                    cache[str(cid)]=c; time.sleep(0.4)
                except Exception as ex:
                    print('  detail fail',name,str(ex)[:50]); c=c or {}
            if c:
                rec['rating']=c.get('rating'); rec['reviews']=c.get('reviews'); rec['category']=(c.get('cats') or [''])[0] if c.get('cats') else (old.get(pid,{}).get('category','')); rec['hours']=c.get('hours') or old.get(pid,{}).get('hours',''); 
                if c.get('addr') and not rec['address']: rec['address']=c['addr']
            if pid in old:
                for k in ('category','hours','rating','reviews','address'):
                    if not rec.get(k): rec[k]=old[pid].get(k)
            out.append(rec)
    json.dump(cache,open('details_cache.json','w')); json.dump(ids,open('ids.json','w'),indent=0)
    gone=[old[i]['name'] for i in old if i not in {r['id'] for r in out}]
    json.dump(out,open('places2.json','w'),ensure_ascii=False,indent=1)
    print('TOTAL',len(out),'places;','removed from lists:',gone or 'none')
if __name__=='__main__': main()
