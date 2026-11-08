#!/usr/bin/env python3
"""Pack the extra gallery tiles (gal/<id>-<k>.jpg, 640x427) into contact sheets of 6 places x 3 photos,
written to ../img/pl/g/sNN.jpg, and emit gallery.json {id:{sheet,cols,rows,row,n,srcs}}.
Usage: python3 make_sheets.py <gal dir>"""
import json, sys, pathlib
from PIL import Image
GAL=pathlib.Path(sys.argv[1]); S=pathlib.Path(__file__).parent
OUT=S.parent/'img'/'pl'/'g'; OUT.mkdir(parents=True,exist_ok=True)
for f in OUT.glob('s*.jpg'): f.unlink()
W,H,COLS,ROWS=640,427,3,6
meta=json.load(open(GAL/'meta.json'))
def nid(i): return (i[0], int(i[1:]))
ids=sorted([k for k,v in meta.items() if v and (GAL/f'{k}-1.jpg').exists()],key=nid)
gallery={}
for si in range(0,len(ids),ROWS):
    chunk=ids[si:si+ROWS]; sheet=Image.new('RGB',(W*COLS,H*ROWS),(234,236,241)); name=f's{si//ROWS+1:02d}.jpg'
    for r,pid in enumerate(chunk):
        srcs=meta[pid]; n=0
        for k in range(min(3,len(srcs))):
            f=GAL/f'{pid}-{k+1}.jpg'
            if not f.exists(): break
            im=Image.open(f).convert('RGB')
            if im.size!=(W,H): im=im.resize((W,H),Image.LANCZOS)
            sheet.paste(im,(k*W,r*H)); n+=1
        gallery[pid]={'sheet':f'img/pl/g/{name}','cols':COLS,'rows':ROWS,'row':r,'n':n,'srcs':srcs[:n]}
    sheet.save(OUT/name,'JPEG',quality=78,optimize=True,progressive=True)
json.dump(gallery,open(S/'gallery.json','w'),ensure_ascii=False,separators=(',',':'))
tot=sum(f.stat().st_size for f in OUT.glob('s*.jpg'))
print(len(ids),'places,',len(list(OUT.glob('s*.jpg'))),'sheets,',round(tot/1e6,1),'MB')
