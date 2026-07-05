import io, os, sys
if not os.path.isdir('app'): print("Run from repo root (/workspaces/z)."); sys.exit(1)
# 1) overwrite Coach.js with v2 (from the zip)
if not os.path.isfile('Coach.js'): print("Coach.js missing from zip."); sys.exit(1)
io.open('app/Coach.js','w',encoding='utf-8').write(io.open('Coach.js',encoding='utf-8').read())
print("+ app/Coach.js overwritten (v2)")
# 2) fix the Play.js Shows-door subtitle: literal \u2014 → em dash
pj = io.open('app/Play.js',encoding='utf-8').read()
bad = 'the traitors, story collab \\u2014 social games'
good = 'the traitors, story collab — social games'
if bad in pj:
    io.open('app/Play.js','w',encoding='utf-8').write(pj.replace(bad, good)); print("+ Play.js door dash fixed")
elif good in pj: print("= Play.js door dash (already)")
else: print("~ Play.js door line not found (skipped)")
