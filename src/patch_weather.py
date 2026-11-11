"""Idempotent: wires weather_ui.js and weather.css into app.js / app.css. Run from anywhere, then build.py."""
import pathlib, re
S=pathlib.Path(__file__).parent
app=(S/'app.js').read_text(encoding='utf-8'); ui=(S/'weather_ui.js').read_text(encoding='utf-8').rstrip()+'\n'
A='// ---------- weather ----------\n'; B='// ---------- rate & day stats ----------'
assert B in app
if A in app: app=app[:app.index(A)]+A+ui+app[app.index(B):]
else: app=app.replace(B,A+ui+B,1)
hook_old='<p class="why">${esc(d.why)}</p>${changes}'; hook_new='<p class="why">${esc(d.why)}</p>${wxDay(d)}${changes}'
if hook_new not in app:
    assert app.count(hook_old)==1; app=app.replace(hook_old,hook_new)
(S/'app.js').write_text(app,encoding='utf-8')
css=(S/'app.css').read_text(encoding='utf-8'); w=(S/'weather.css').read_text(encoding='utf-8').rstrip()+'\n'
C='/* ---- weather ---- */\n'; D='/* ---- end weather ---- */\n'
if C in css: css=css[:css.index(C)]+C+w+D+css[css.index(D)+len(D):]
else: css=css.rstrip()+'\n'+C+w+D
(S/'app.css').write_text(css,encoding='utf-8')
print('weather wired', len(app), len(css))
