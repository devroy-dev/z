import io, os, sys
# full-file overwrite of app/Coach.js with the redesigned version
if not os.path.isdir('app'): print("Run from repo root (/workspaces/z)."); sys.exit(1)
if not os.path.isfile('Coach.js'): print("Coach.js missing from zip."); sys.exit(1)
new = io.open('Coach.js', encoding='utf-8').read()
io.open('app/Coach.js', 'w', encoding='utf-8').write(new)
print("+ app/Coach.js overwritten with redesign (%d lines)" % new.count(chr(10)))
