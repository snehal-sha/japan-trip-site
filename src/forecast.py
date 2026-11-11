#!/usr/bin/env python3
"""Trip forecast, Nov 16-25 2026. Usage: python3 forecast.py
Prints, per area and day: best-match weather, then rain mm / cloud % from three models
(ECMWF, GFS, JMA), then the Japan Meteorological Agency weekly outlook (pop %, reliability A-C).
No personal data is sent: only coordinates of public places. Past about 7 days treat it as a hint."""
import json, urllib.request
P={'Tokyo':(35.68,139.76),'Fuji lakes (Motosu, Shoji)':(35.46,138.60),'Shiraito Falls':(35.31,138.59),'Ito / Jogasaki':(34.97,139.10),
   'Hakone / Izu Skyline':(35.20,139.02),'Kyoto city (Waraku, Enkoji)':(35.01,135.77),'Ohara':(35.12,135.83),'Mitarai Valley':(34.25,135.85),'Nara':(34.69,135.84)}
M=['ecmwf_ifs025','gfs_seamless','jma_seamless']
W={0:'clear',1:'mostly clear',2:'part cloud',3:'overcast',45:'fog',48:'fog',51:'drizzle',53:'drizzle',55:'drizzle',61:'light rain',63:'rain',65:'heavy rain',
   71:'snow',73:'snow',75:'snow',80:'showers',81:'showers',82:'heavy showers',85:'snow showers',95:'thunder',96:'thunder'}
UA={'User-Agent':'trip-planner/1.0'}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
base='https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&timezone=Asia%%2FTokyo&forecast_days=16&daily='
print('rain mm / cloud % per model:',', '.join(M))
for k,(la,lo) in P.items():
    try:
        b=get(base%(la,lo)+'weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min,sunrise,sunset')['daily']
        m=get(base%(la,lo)+'precipitation_sum,cloud_cover_mean&models='+','.join(M))['daily']
    except Exception as e:
        print('==',k,'ERR',e); continue
    print('==',k)
    for i,t in enumerate(b['time']):
        if not ('2026-11-16'<=t<='2026-11-25'): continue
        row=[]
        for x in M:
            r=m.get('precipitation_sum_'+x,[None]*99)[i]; c=m.get('cloud_cover_mean_'+x,[None]*99)[i]
            row.append('%s/%s'%('-' if r is None else r,'-' if c is None else c))
        print(t,'%-13s'%W.get(b['weather_code'][i],b['weather_code'][i]),'pop',b['precipitation_probability_max'][i],'%',
              b['temperature_2m_min'][i],'to',b['temperature_2m_max'][i],'C','sun',b['sunrise'][i][-5:],b['sunset'][i][-5:],'|','  '.join(row))
print('\nJMA weekly outlook (codes 100s fine, 200s cloudy, 300s rain; reliability A best)')
for code,name in (('130000','Tokyo'),('220000','Shizuoka (Ito, Fuji south)'),('190000','Yamanashi (Fuji lakes)'),('140000','Kanagawa (Hakone)'),('260000','Kyoto'),('290000','Nara')):
    try:
        wk=get('https://www.jma.go.jp/bosai/forecast/data/forecast/%s.json'%code)[1]['timeSeries'][0]; a=wk['areas'][0]
        print(name+':',' '.join('%s=%s/%s%%/%s'%(t[5:10],w,p or '-',r or '-') for t,w,p,r in zip(wk['timeDefines'],a['weatherCodes'],a['pops'],a['reliabilities'])))
    except Exception as e:
        print(name,'ERR',e)
