// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TRADING FLOOR. Paper trading with the cast in the room:
//  market list (live INR, 24h chips) → trade sheet (qty + ₹ chips + cost
//  preview) → portfolio marked to market → friends leaderboard. The
//  economist reacts to your trades; the oracle reads the charts daily.
//  Server is law: every trade executes at the SERVER price via /sim/trade.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import { NIGHT as C, FONTS } from './theme';
import { simMarket, simPortfolio, simTrade, simRemark, simLeaderboard, simOracle } from './api';

const TEAL = '#6FC9E0';
const UP = '#8FD98F';
const DOWN = '#F0708C';

// Indian-grouped rupees; sub-rupee coins (SHIB) keep their precision
const inr = (n) => {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) < 1) return '₹' + n.toLocaleString('en-IN', { maximumSignificantDigits: 4 });
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: n < 100 ? 2 : 0 });
};
const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);
const qtyFmt = (q) => Number(q).toLocaleString('en-IN', { maximumFractionDigits: 8 });

function Chip({ v }) {
  const up = (v ?? 0) >= 0;
  return (
    <View style={[st.chip, { backgroundColor: up ? 'rgba(143,217,143,0.12)' : 'rgba(240,112,140,0.12)' }]}>
      <Text style={{ fontFamily: FONTS.semibold, fontSize: 11.5, color: up ? UP : DOWN }}>{pct(v)}</Text>
    </View>
  );
}

// ── the trade sheet ────────────────────────────────────────────────────────
function TradeSheet({ coin, holding, cash, onDone, onClose }) {
  const [side, setSide] = useState('buy');
  const [qtyStr, setQtyStr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const price = coin?.price ?? 0;
  const qty = parseFloat(qtyStr) || 0;
  const cost = qty * price;
  const held = holding?.qty || 0;

  const setByAmount = (amt) => {
    if (!price) return;
    const q = amt / price;
    setQtyStr(q.toPrecision(6).replace(/\.?0+$/, ''));
  };
  const setMax = () => {
    if (side === 'buy') setByAmount(Math.max(0, cash));
    else setQtyStr(String(held));
  };

  const fire = async () => {
    setErr('');
    if (!(qty > 0)) { setErr('enter a quantity'); return; }
    setBusy(true);
    try {
      const r = await simTrade(coin.symbol, side, qty);
      onDone(r?.trade || null);
    } catch (e) {
      setErr(String(e?.message || e).slice(0, 140));
    }
    setBusy(false);
  };

  const canAfford = side === 'sell' || cost <= cash;
  const canSell = side === 'buy' || qty <= held;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.sheetDim} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={st.sheetTitle}>{coin.name}</Text>
            <Text style={st.sheetPrice}>{inr(price)}</Text>
          </View>
          <Text style={st.sheetSub}>
            {side === 'buy' ? `cash ${inr(cash)}` : `you hold ${qtyFmt(held)} ${coin.symbol}`}
          </Text>

          <View style={st.sideRow}>
            {['buy', 'sell'].map((s) => (
              <Pressable key={s} onPress={() => { setSide(s); setErr(''); }}
                style={[st.sideBtn, side === s && { borderColor: s === 'buy' ? UP : DOWN, backgroundColor: s === 'buy' ? 'rgba(143,217,143,0.08)' : 'rgba(240,112,140,0.08)' }]}>
                <Text style={[st.sideTxt, side === s && { color: s === 'buy' ? UP : DOWN }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={st.qtyInput} value={qtyStr} onChangeText={(t) => { setQtyStr(t.replace(/[^0-9.]/g, '')); setErr(''); }}
            placeholder={`qty of ${coin.symbol}`} placeholderTextColor={C.faint}
            keyboardType="decimal-pad"
          />
          <View style={st.amtRow}>
            {[1000, 10000, 100000].map((a) => (
              <Pressable key={a} style={st.amtChip} onPress={() => setByAmount(a)}>
                <Text style={st.amtTxt}>{a >= 100000 ? '₹1L' : a >= 10000 ? '₹10k' : '₹1k'}</Text>
              </Pressable>
            ))}
            <Pressable style={st.amtChip} onPress={setMax}><Text style={st.amtTxt}>max</Text></Pressable>
          </View>

          <View style={st.costRow}>
            <Text style={st.costLbl}>{side === 'buy' ? 'this will cost' : 'this returns'}</Text>
            <Text style={[st.costVal, !canAfford || !canSell ? { color: DOWN } : null]}>{inr(cost)}</Text>
          </View>
          {!canAfford ? <Text style={st.err}>that's more cash than the book holds</Text> : null}
          {!canSell ? <Text style={st.err}>that's more {coin.symbol} than you hold</Text> : null}
          {err ? <Text style={st.err}>{err}</Text> : null}

          <Pressable disabled={busy || !(qty > 0) || !canAfford || !canSell} onPress={fire}
            style={[st.fireBtn, { backgroundColor: side === 'buy' ? 'rgba(143,217,143,0.14)' : 'rgba(240,112,140,0.14)', borderColor: side === 'buy' ? UP : DOWN, opacity: busy || !(qty > 0) || !canAfford || !canSell ? 0.4 : 1 }]}>
            {busy ? <ActivityIndicator color={C.cream} /> :
              <Text style={[st.fireTxt, { color: side === 'buy' ? UP : DOWN }]}>{side} {coin.symbol}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── the floor ─────────────────────────────────────────────────────────────
export default function TradingFloor({ onExit = () => {} }) {
  const [tab, setTab] = useState('market'); // market | book | board
  const [market, setMarket] = useState(null);
  const [book, setBook] = useState(null);
  const [board, setBoard] = useState(null);
  const [oracle, setOracle] = useState(null);
  const [oracleOpen, setOracleOpen] = useState(false);
  const [sheet, setSheet] = useState(null);       // coin being traded
  const [remark, setRemark] = useState(null);     // the economist's last line
  const alive = useRef(true);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([simMarket(), simPortfolio()]);
    if (!alive.current) return;
    if (m?.coins) setMarket(m.coins);
    if (p) setBook(p);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    simOracle().then((o) => { if (alive.current && o?.body) setOracle(o.body); });
    const t = setInterval(load, 30000); // gentle refresh; prices move every 10 min server-side
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  useEffect(() => {
    if (tab === 'board') simLeaderboard().then((b) => { if (alive.current && b?.board) setBoard(b.board); });
  }, [tab]);

  const holdingOf = (sym) => (book?.positions || []).find((p) => p.symbol === sym);

  const onTraded = async (trade) => {
    setSheet(null);
    await load();
    if (trade) {
      const r = await simRemark();
      if (alive.current && r?.line) setRemark(r.line);
    }
  };

  const anyStale = (market || []).some((c) => c.stale);

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0C1216', '#0A0D12', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.header}>
          <Pressable onPress={onExit} hitSlop={12}><Text style={st.back}>‹ the sims</Text></Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={st.title}>the trading floor</Text>
            {book ? <Text style={st.totalVal}>{inr(book.total_value)}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 }}>
            <Text style={st.disclaimer}>phantom money · real prices · zero real value</Text>
            {book ? <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: (book.day_pnl ?? 0) >= 0 ? UP : DOWN }}>{pct(book.day_pnl_pct)} today</Text> : null}
          </View>
          {anyStale ? <Text style={st.stale}>some prices are stale — showing the last real quote, never a made-up one</Text> : null}
        </View>

        <View style={st.tabs}>
          {[['market', 'market'], ['book', 'your book'], ['board', 'the board']].map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
              <Text style={[st.tabTxt, tab === k && { color: C.cream }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {remark ? (
          <Pressable style={st.remark} onPress={() => setRemark(null)}>
            <Text style={st.remarkWho}>the economist</Text>
            <Text style={st.remarkTxt}>{remark}</Text>
          </Pressable>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {tab === 'market' && (
            <>
              {oracle ? (
                <Pressable style={st.oracle} onPress={() => setOracleOpen((v) => !v)}>
                  <Text style={st.oracleWho}>the oracle's reading · today</Text>
                  <Text style={st.oracleTxt} numberOfLines={oracleOpen ? undefined : 2}>{oracle}</Text>
                </Pressable>
              ) : null}
              {!market ? <ActivityIndicator color={TEAL} style={{ marginTop: 40 }} /> :
                market.map((c) => {
                  const h = holdingOf(c.symbol);
                  return (
                    <Pressable key={c.symbol} style={st.row} onPress={() => c.price != null && setSheet(c)}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.sym}>{c.symbol}{h ? <Text style={st.held}>  · you hold {qtyFmt(h.qty)}</Text> : null}</Text>
                        <Text style={st.name}>{c.name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={st.price}>{inr(c.price)}</Text>
                        <Chip v={c.changed_24h} />
                      </View>
                    </Pressable>
                  );
                })}
            </>
          )}

          {tab === 'book' && (!book ? <ActivityIndicator color={TEAL} style={{ marginTop: 40 }} /> : (
            <>
              <View style={st.bookTop}>
                <View style={st.bookCell}><Text style={st.bookLbl}>cash</Text><Text style={st.bookVal}>{inr(book.cash)}</Text></View>
                <View style={st.bookCell}><Text style={st.bookLbl}>overall</Text><Text style={[st.bookVal, { color: (book.total_pnl ?? 0) >= 0 ? UP : DOWN }]}>{pct(book.total_pnl_pct)}</Text></View>
                <View style={st.bookCell}><Text style={st.bookLbl}>today</Text><Text style={[st.bookVal, { color: (book.day_pnl ?? 0) >= 0 ? UP : DOWN }]}>{pct(book.day_pnl_pct)}</Text></View>
              </View>
              {!book.positions.length ?
                <Text style={st.empty}>no positions yet. the market's one tab away — the economist is waiting to judge you.</Text> :
                book.positions.map((p) => (
                  <Pressable key={p.symbol} style={st.row} onPress={() => { const c = (market || []).find((m) => m.symbol === p.symbol); if (c) setSheet(c); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sym}>{p.symbol}</Text>
                      <Text style={st.name}>{qtyFmt(p.qty)} @ {inr(p.avg_cost)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={st.price}>{inr(p.value)}</Text>
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 11.5, color: (p.pnl ?? 0) >= 0 ? UP : DOWN }}>{pct(p.pnl_pct)} · {inr(p.pnl)}</Text>
                    </View>
                  </Pressable>
                ))}
            </>
          ))}

          {tab === 'board' && (!board ? <ActivityIndicator color={TEAL} style={{ marginTop: 40 }} /> : (
            <>
              {board.map((r) => (
                <View key={r.user_id} style={[st.row, r.you && { borderColor: 'rgba(111,201,224,0.35)' }]}>
                  <Text style={st.rank}>{r.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.sym}>{r.you ? 'you' : (r.display_name || (r.handle ? '@' + r.handle : 'a trader'))}</Text>
                    {r.handle && !r.you ? <Text style={st.name}>@{r.handle}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.price}>{inr(r.total_value)}</Text>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 11.5, color: (r.total_pnl_pct ?? 0) >= 0 ? UP : DOWN }}>{pct(r.total_pnl_pct)}</Text>
                  </View>
                </View>
              ))}
              {board.length <= 1 ? <Text style={st.empty}>just you on the board. add friends from the You tab — a leaderboard of one is a mirror.</Text> : null}
            </>
          ))}
        </ScrollView>
      </SafeAreaView>

      {sheet ? (
        <TradeSheet
          coin={sheet}
          holding={holdingOf(sheet.symbol)}
          cash={book?.cash ?? 0}
          onDone={onTraded}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginBottom: 8 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 27 },
  totalVal: { fontFamily: FONTS.display, color: TEAL, fontSize: 21 },
  disclaimer: { fontFamily: FONTS.body, color: C.faint, fontSize: 10.5, letterSpacing: 0.4 },
  stale: { fontFamily: FONTS.light, color: '#E0C088', fontSize: 11, marginTop: 6 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,240,228,0.08)' },
  tabOn: { borderColor: 'rgba(111,201,224,0.4)', backgroundColor: 'rgba(111,201,224,0.07)' },
  tabTxt: { fontFamily: FONTS.medium, color: C.faint, fontSize: 13 },

  remark: { marginHorizontal: 20, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', backgroundColor: 'rgba(243,168,95,0.06)', padding: 14 },
  remarkWho: { fontFamily: FONTS.body, color: C.ember, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  remarkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 14.5, lineHeight: 21, marginTop: 5 },

  oracle: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,155,232,0.2)', backgroundColor: 'rgba(201,155,232,0.05)', padding: 14, marginBottom: 12 },
  oracleWho: { fontFamily: FONTS.body, color: '#C99BE8', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  oracleTxt: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },

  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', padding: 15, marginBottom: 9, gap: 12 },
  sym: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 15 },
  held: { fontFamily: FONTS.light, color: TEAL, fontSize: 12 },
  name: { fontFamily: FONTS.light, color: C.faint, fontSize: 12, marginTop: 2 },
  price: { fontFamily: FONTS.display, color: C.cream, fontSize: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5, marginTop: 4 },
  rank: { fontFamily: FONTS.display, color: C.faint, fontSize: 17, width: 26 },
  empty: { fontFamily: FONTS.light, color: C.faint, fontSize: 13, lineHeight: 19, marginTop: 20, textAlign: 'center', paddingHorizontal: 20 },

  bookTop: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  bookCell: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', padding: 13, alignItems: 'center' },
  bookLbl: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  bookVal: { fontFamily: FONTS.display, color: C.cream, fontSize: 16, marginTop: 4 },

  sheetDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: '#101018', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: 'rgba(255,240,228,0.1)', padding: 22, paddingBottom: 34 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,228,0.15)', marginBottom: 14 },
  sheetTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 23 },
  sheetPrice: { fontFamily: FONTS.display, color: TEAL, fontSize: 18 },
  sheetSub: { fontFamily: FONTS.light, color: C.faint, fontSize: 12.5, marginTop: 4 },

  sideRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  sideBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,240,228,0.1)', paddingVertical: 10, alignItems: 'center' },
  sideTxt: { fontFamily: FONTS.semibold, color: C.faint, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },

  qtyInput: { fontFamily: FONTS.display, color: C.cream, fontSize: 21, borderBottomWidth: 1, borderColor: 'rgba(255,240,228,0.12)', paddingVertical: 9, marginTop: 16 },
  amtRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  amtChip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(111,201,224,0.25)', paddingHorizontal: 13, paddingVertical: 6 },
  amtTxt: { fontFamily: FONTS.medium, color: TEAL, fontSize: 12.5 },

  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 },
  costLbl: { fontFamily: FONTS.light, color: C.muted, fontSize: 13 },
  costVal: { fontFamily: FONTS.display, color: C.cream, fontSize: 19 },
  err: { fontFamily: FONTS.body, color: DOWN, fontSize: 12, marginTop: 8 },

  fireBtn: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  fireTxt: { fontFamily: FONTS.semibold, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1.5 },
});
