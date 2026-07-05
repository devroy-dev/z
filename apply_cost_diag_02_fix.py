#!/usr/bin/env python3
# cost-diag 02 FIX — the /diagnostics/costs endpoint called resolveUser(authId)
# without the null-guard every other endpoint has, so authId stayed string|null
# and tsc failed (TS2345). Adds the standard `if (!authId) return 401` guard.
import io, sys
P = 'src/index.ts'
old = ("    const authId = await authUser(req);\n"
       "    const user = await resolveUser(authId);\n"
       "    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });")
new = ("    const authId = await authUser(req);\n"
       "    if (!authId) return res.status(401).json({ error: 'unauthorized' });\n"
       "    const user = await resolveUser(authId);\n"
       "    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });")
s = io.open(P, encoding='utf-8').read()
if new in s: print("= already applied"); sys.exit(0)
if s.count(old) != 1: print(f"! anchor count {s.count(old)} (need 1) — abort"); sys.exit(1)
io.open(P, 'w', encoding='utf-8').write(s.replace(old, new))
print("+ diagnostics/costs auth guard applied")
