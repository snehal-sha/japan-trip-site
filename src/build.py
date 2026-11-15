import pathlib, os
S=pathlib.Path(__file__).parent
r=lambda f:(S/f).read_text(encoding='utf-8')
js=''.join(r(f) for f in ['place_photos.js','japan.js','places.generated.js','data.js','photos.js'])+'window.RATE='+r('rate.json').strip()+';\nwindow.GALLERY='+r('gallery.json').strip()+';\n'+r('app.js')
page=r('head.html')+'<style>\n'+r('leaflet.css')+'\n'+r('app.css')+'\n</style>\n'+r('sprite.svg')+'\n'+r('header.html')+r('body.html')+'<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>\n<script>\n'+js+'\n</script>\n'
# On Snehal's Mac the build goes to VisaDocs/japan-trip (index.html for the artifact, preview.html for Pages).
# Anywhere else (a cloud Claude Code session, a fresh clone) it goes to build/ and the Pages page is written straight to the repo root.
LOCAL=pathlib.Path('/Users/ssha/work_oct/VisaDocs/japan-trip')
CLOUD=os.environ.get('JTS_CLOUD')=='1' or not LOCAL.is_dir()
out=(S.parent/'build') if CLOUD else LOCAL
out.mkdir(exist_ok=True)
(out/'index.html').write_text(page,encoding='utf-8')
(out/'preview.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-family:system-ui;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+page+'</body></html>',encoding='utf-8')
print('index.html',(out/'index.html').stat().st_size)
if CLOUD:
    (S.parent/'index.html').write_text((out/'preview.html').read_text(encoding='utf-8'),encoding='utf-8')
    print('wrote repo index.html for GitHub Pages')
