import json, re
P=json.load(open('places2.json')); EX=json.load(open('extras.json'))
EXCLUDE={'p27'}  # removed from the site on request (Kabukicho)
P=[p for p in P if p['id'] not in EXCLUDE]
DUR={'museum':90,'aquarium':120,'castle':60,'garden':60,'park':60,'temple':45,'shrine':30,'cemetery':30,'bar':90,'restaurant':60,'ramen':40,'udon':40,'sushi':60,'pizza':60,'market':75,'flea':90,'mall':75,'store':45,'shop':45,'street':60,'scenic':30,'viewpoint':20,'river':40,'lake':30,'island':120,'theater':100,'observation':90,'station':10,'hotel':30,'inn':30,'hostel':30,'tourist attraction':45,'city':120,'ward':120,'neighbourhood':120,'district':120}
def dur(cat):
    c=(cat or '').lower()
    for k,v in DUR.items():
        if k in c: return v
    return 45
out=[]
for p in P:
    e=EX.get(p['id']) or dict(area=(p['address'].split(',')[-2].strip() if p['address'].count(',')>=2 else p['address'] or ''),day=0,best='',use='New on your '+p['list']+' list; no notes yet',tip='')
    out.append(dict(id=p['id'],src='you',list=p['list'],name=p['name'],note=p['note'],area=e['area'],day=e['day'],address=p['address'],lat=p['lat'],lng=p['lng'],rating=p['rating'],reviews=p['reviews'],cat=p['category'],hours=p['hours'],best=e['best'],use=e['use'],tip=e['tip'],maps=p['maps'],dur=dur(p['category'] or e['use'])))
open('places.generated.js','w',encoding='utf-8').write('window.PLACES = '+json.dumps(out,ensure_ascii=False)+';\n')
print(len(out),'places generated')
