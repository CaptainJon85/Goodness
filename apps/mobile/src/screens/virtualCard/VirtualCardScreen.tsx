import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../../lib/api'
import { formatGBP } from '../../lib/format'
import type { VirtualCard, Transaction } from '@clearpath/shared'
import FeatureGate from '../../components/shared/FeatureGate'

type RoutingMode = 'maximise_rewards' | 'minimise_cost' | 'protect_score'

const ROUTING_OPTIONS: { id: RoutingMode; icon: string; label: string; desc: string }[] = [
  { id: 'maximise_rewards', icon: '🎁', label: 'Maximise rewards', desc: 'Best cashback for each merchant' },
  { id: 'minimise_cost',    icon: '📉', label: 'Minimise cost',    desc: 'Always uses your lowest APR card' },
  { id: 'protect_score',   icon: '🛡',  label: 'Protect score',   desc: 'Keeps utilisation below 30%' },
]

type TxItem = Transaction & { allocatedToCardNickname?: string }

export default function VirtualCardScreen() {
  const [card, setCard] = useState<VirtualCard | null>(null)
  const [txs, setTxs] = useState<TxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activating, setActivating] = useState(false)
  const [freezeLoading, setFreezeLoading] = useState(false)
  const [routingLoading, setRoutingLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const c = await api.virtualCard.get()
      setCard(c)
      const t = await api.virtualCard.transactions()
      setTxs(t as TxItem[])
    } catch { setCard(null) }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function activate() {
    setActivating(true)
    try {
      const c = await api.virtualCard.activate()
      setCard(c)
    } catch (err) {
      const e = err as Error & { code?: string }
      if (e.code === 'KYC_REQUIRED') Alert.alert('Verification required', 'Complete identity verification before activating your virtual card.')
      else Alert.alert('Error', e.message)
    } finally { setActivating(false) }
  }

  async function toggleFreeze() {
    if (!card) return
    setFreezeLoading(true)
    try {
      const { isFrozen } = await api.virtualCard.freeze(!card.isFrozen)
      setCard((c) => c ? { ...c, isFrozen } : c)
    } catch (err) { Alert.alert('Error', (err as Error).message) }
    finally { setFreezeLoading(false) }
  }

  async function changeMode(mode: RoutingMode) {
    if (!card || card.routingMode === mode) return
    setRoutingLoading(true)
    try {
      const { routingMode } = await api.virtualCard.setRoutingMode(mode)
      setCard((c) => c ? { ...c, routingMode: routingMode as RoutingMode } : c)
    } catch (err) { Alert.alert('Error', (err as Error).message) }
    finally { setRoutingLoading(false) }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <FeatureGate requiredTier="premium">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <Text style={styles.title}>Virtual Card</Text>
        <Text style={styles.subtitle}>Smart Mastercard that routes spend automatically</Text>

        {!card ? (
          <View style={styles.activateCard}>
            <Text style={styles.activateIcon}>💎</Text>
            <Text style={styles.activateTitle}>Activate your smart card</Text>
            <Text style={styles.activateDesc}>
              Your ClearPath virtual Mastercard routes each purchase to the best card in your wallet.
            </Text>
            <View style={styles.featureList}>
              {['Works everywhere Mastercard is accepted', 'Earns cashback on your best rewards card', 'Protects your credit score automatically'].map((f) => (
                <Text key={f} style={styles.featureItem}>✓ {f}</Text>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, activating && styles.btnDisabled]} onPress={activate} disabled={activating}>
              {activating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Activate virtual card</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Card visual */}
            <View style={[styles.cardVisual, card.isFrozen && styles.cardFrozen]}>
              <View style={styles.cardTop}>
                <Text style={styles.cardBrand}>ClearPath</Text>
                <Text style={styles.cardType}>Virtual Card</Text>
              </View>
              <Text style={styles.cardPan}>**** **** **** ????</Text>
              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.cardMetaLabel}>EXPIRES</Text>
                  <Text style={styles.cardMeta}>••/••</Text>
                </View>
                <View style={styles.mastercardCircles}>
                  <View style={[styles.mcCircle, { backgroundColor: 'rgba(255,0,0,0.8)' }]} />
                  <View style={[styles.mcCircle, { backgroundColor: 'rgba(255,165,0,0.8)', marginLeft: -12 }]} />
                </View>
              </View>
              {card.isFrozen && (
                <View style={styles.frozenOverlay}>
                  <Text style={styles.frozenText}>❄ Frozen</Text>
                </View>
              )}
            </View>

            {/* Freeze toggle */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardRowTitle}>{card.isFrozen ? '❄ Card frozen' : '✅ Card active'}</Text>
                  <Text style={styles.cardRowSub}>{card.isFrozen ? 'No transactions will be processed' : 'Ready to use anywhere'}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallBtn, card.isFrozen ? styles.smallBtnPrimary : styles.smallBtnOutline]}
                  onPress={toggleFreeze}
                  disabled={freezeLoading}
                >
                  <Text style={[styles.smallBtnText, card.isFrozen ? styles.smallBtnTextPrimary : styles.smallBtnTextOutline]}>
                    {freezeLoading ? '…' : card.isFrozen ? 'Unfreeze' : 'Freeze'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Routing mode */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Routing mode</Text>
              {routingLoading && <ActivityIndicator size="small" color="#2563eb" style={{ marginBottom: 8 }} />}
              {ROUTING_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.modeOption, card.routingMode === opt.id && styles.modeOptionActive]}
                  onPress={() => changeMode(opt.id)}
                  disabled={routingLoading}
                >
                  <Text style={styles.modeIcon}>{opt.icon}</Text>
                  <View style={styles.modeText}>
                    <Text style={[styles.modeLabel, card.routingMode === opt.id && styles.modeLabelActive]}>{opt.label}</Text>
                    <Text style={styles.modeDesc}>{opt.desc}</Text>
                  </View>
                  {card.routingMode === opt.id && <Text style={styles.modeCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>

            {/* Transaction feed */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recent transactions</Text>
              {txs.length === 0 ? (
                <Text style={styles.noTxs}>No transactions yet. Make a purchase to see routing in action.</Text>
              ) : (
                txs.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txInfo}>
                      <Text style={styles.txMerchant}>{tx.merchantName || 'Unknown merchant'}</Text>
                      <Text style={styles.txReason} numberOfLines={1}>{tx.allocationReason}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={styles.txAmount}>{formatGBP(tx.amount)}</Text>
                      {(tx.rewardEarned ?? 0) > 0 && (
                        <Text style={styles.txReward}>+{formatGBP(tx.rewardEarned)}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </FeatureGate>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  activateCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  activateIcon: { fontSize: 48, marginBottom: 12 },
  activateTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  activateDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  featureList: { alignSelf: 'stretch', marginBottom: 20 },
  featureItem: { fontSize: 13, color: '#374151', paddingVertical: 4 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardVisual: { borderRadius: 20, padding: 20, marginBottom: 16, height: 180, backgroundColor: '#1d4ed8', overflow: 'hidden' },
  cardFrozen: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  cardBrand: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  cardType: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cardPan: { color: '#fff', fontFamily: 'monospace', fontSize: 18, letterSpacing: 4, marginBottom: 16 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardMetaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 8, letterSpacing: 1 },
  cardMeta: { color: '#fff', fontFamily: 'monospace', fontSize: 14 },
  mastercardCircles: { flexDirection: 'row' },
  mcCircle: { width: 30, height: 30, borderRadius: 15 },
  frozenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  frozenText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardRowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardRowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  smallBtnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  smallBtnOutline: { backgroundColor: '#fff', borderColor: '#d1d5db' },
  smallBtnText: { fontSize: 13, fontWeight: '700' },
  smallBtnTextPrimary: { color: '#fff' },
  smallBtnTextOutline: { color: '#374151' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  modeOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 8 },
  modeOptionActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  modeIcon: { fontSize: 22, marginRight: 12 },
  modeText: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modeLabelActive: { color: '#1d4ed8' },
  modeDesc: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  modeCheck: { color: '#2563eb', fontWeight: '800', fontSize: 16 },
  noTxs: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  txRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txReason: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700', color: '#111827' },
  txReward: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
})
