import io,sys
D='app/Desk.js'; s=io.open(D,encoding='utf-8').read()
old="{[...TABLE_CAST.map((p) => p.key), 'the_anchor', 'the_coach'].map((k) => ("
new="{['the_coach', ...TABLE_CAST.map((p) => p.key), 'the_anchor'].map((k) => ("
if new in s: print("already front"); sys.exit(0)
if s.count(old)!=1: print(f"anchor x{s.count(old)} — ABORT"); sys.exit(1)
io.open(D,'w',encoding='utf-8').write(s.replace(old,new)); print("+ coach moved to front of cast row")
