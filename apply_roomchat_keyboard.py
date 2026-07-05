#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  RoomChat keyboard fix — run from repo root: python3 apply_roomchat_keyboard.py
#  App-only (OTA). Transactional + idempotent.
#
#  Bug: tapping the composer then tapping outside leaves a black gap near the chat.
#  Cause: RoomChat's content isn't wrapped in a KeyboardAvoidingView, so with
#  softwareKeyboardLayoutMode "pan" the layout doesn't settle on keyboard show/hide.
#  Chat.js (the 1:1 persona chat, which behaves) wraps its SafeAreaView in a
#  KeyboardAvoidingView behavior="padding" — mirror that exactly. Fixes all rooms.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

R = 'app/RoomChat.js'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# import KeyboardAvoidingView
E("import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Share, Alert } from 'react-native';",
  "import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Share, Alert, KeyboardAvoidingView } from 'react-native';",
  "import KeyboardAvoidingView", marker=", KeyboardAvoidingView } from 'react-native'")

# wrap the SafeAreaView open
E("      <SafeAreaView style={{ flex: 1, display: liveSession ? 'none' : 'flex' }} edges={['top', 'bottom']}>",
  "      <KeyboardAvoidingView style={{ flex: 1 }} behavior=\"padding\" keyboardVerticalOffset={0}>\n"
  "      <SafeAreaView style={{ flex: 1, display: liveSession ? 'none' : 'flex' }} edges={['top', 'bottom']}>",
  "wrap open (KAV)", marker='behavior="padding" keyboardVerticalOffset={0}')

# close the wrap
E("      </SafeAreaView>",
  "      </SafeAreaView>\n      </KeyboardAvoidingView>",
  "wrap close (KAV)", marker="</SafeAreaView>\n      </KeyboardAvoidingView>")

# ── apply (transactional + idempotent) ──────────────────────────────────
if not os.path.isfile(R): print("Run from repo root (no app/RoomChat.js)."); sys.exit(1)
staged = io.open(R, encoding='utf-8').read()
planned, skipped = [], []
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT (nothing written)"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(R, 'w', encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}. App-only → OTA: expo export → eas update --branch preview.")
