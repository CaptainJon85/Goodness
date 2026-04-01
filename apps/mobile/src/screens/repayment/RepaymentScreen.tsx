import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { api } from '../../lib/api'
import { formatGBP, formatDate } from '../../lib/format'
import type { RepaymentPlan, CreditCard } from '@clearpath/shared'
import FeatureGate from '../../components/shared/FeatureGate'

export default function RepaymentScreen() {
  const [plan, setPlan] = useState<RepaymentPlan | null>(null)
  const [cards, setCards] = useState<CreditCard[]>([])
  const [method, setMethod] = useState<'avalanche' | 'snowball'>('avalanche')
  const [budget, setBudget] = useState('500')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api.repayment.getPlan().catch(() => null),
        api.cards.list(),
      ])
      if (p) { setPlan(p); setMethod(p.method); setBudget((p.monthlyBudget / 100).toFixed(0)) }
      setCards(c)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function generate() {
    const budgetPence = Math.round(parseFloat(budget) * 100)
    if (isNaN(budgetPence) || budgetPence <= 0) { Alert.alert('Error', 'Enter a valid monthly budget'); return }
    setGenerating(true)
    try {
      const p = await api.repayment.generate(budgetPence, method)
      setPlan(p)
    } catch (err) {
      const e = err as Error & { code?: string }
      if (e.code === 'TIER_REQUIRED') { Alert.alert('Upgrade required', 'Repayment planning requires a Plus subscription.') }
      else { Alert.alert('Error', e.message) }
    } finally { setGenerating(false) }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <FeatureGate requiredTier="plus">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <Text style={styles.title}>Repayment Plan</Text>
        <Text style={styles.subtitle}>AI-powered debt elimination strategy</Text>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Text style={styles.label}>Monthly budget (£)</Text>
          <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="500" />

          <Text style={styles.label}>Strategy</Text>
          <View style={styles.toggleRow}>
            {(['avalanche', 'snowball'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.toggleBtn, method === m && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, method === m && styles.toggleTextActive]}>
                  {m === 'avalanche' ? '🔥 Avalanche' : '⛄ Snowball'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.strategyDesc}>
            {method === 'avalanche'
              ? 'Target highest APR first — minimises total interest paid.'
              : 'Target smallest balance first — builds momentum with quick wins.'}
          </Text>

          <TouchableOpacity style={[styles.btn, (generating || cards.length === 0) && styles.btnDisabled]} onPress={generate} disabled={generating || cards.length === 0}>
            {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>{plan ? 'Regenerate plan' : 'Generate plan'}</Text>}
          </TouchableOpacity>

          {cards.length === 0 && <Text style={styles.noCards}>Add cards first before generating a plan.</Text>}
        </View>

        {/* Plan summary */}
        {plan && (
          <>
            <View style={styles.card}>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>{plan.method === 'avalanche' ? '🔥 Avalanche' : '⛄ Snowball'}</Text>
              </View>
              <View style={styles.statsGrid}>
                <Stat label="Debt-free by" value={plan.projectedPayoffDate ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(plan.projectedPayoffDate)) : '—'} />
                <Stat label="Months" value={String(plan.payoffMonths)} />
                <Stat label="Interest paid" value={formatGBP(plan.totalInterestPaid)} />
                <Stat label="Interest saved" value={formatGBP(plan.totalInterestSaved)} highlight />
              </View>
              {plan.narrative ? (
                <View style={styles.narrativeBox}>
                  <Text style={styles.narrativeLabel}>✨ AI insight</Text>
                  <Text style={styles.narrativeText}>{plan.narrative}</Text>
                </View>
              ) : null}
            </View>

            {/* Allocations */}
            <Text style={styles.sectionTitle}>Monthly allocations</Text>
            {plan.allocations.map((alloc) => {
              const card = cards.find((c) => c.id === alloc.cardId)
              return (
                <View key={alloc.cardId} style={[styles.allocCard, !alloc.isMinimumOnly && styles.allocCardPriority]}>
                  <View style={styles.allocHeader}>
                    <Text style={styles.allocName}>{card?.nickname ?? alloc.cardId}</Text>
                    <Text style={styles.allocAmount}>{formatGBP(alloc.monthlyAmount)}<Text style={styles.allocSub}>/mo</Text></Text>
                  </View>
                  <View style={styles.allocTags}>
                    {!alloc.isMinimumOnly && <View style={styles.priorityTag}><Text style={styles.priorityTagText}>Priority</Text></View>}
                    {alloc.isMinimumOnly && <Text style={styles.minOnlyText}>Minimum only</Text>}
                  </View>
                  <Text style={styles.allocReason}>{alloc.reasoning}</Text>
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </FeatureGate>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 14 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#f9fafb' },
  toggleBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#fff' },
  strategyDesc: { fontSize: 12, color: '#9ca3af', marginBottom: 14 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  noCards: { textAlign: 'center', fontSize: 12, color: '#f59e0b', marginTop: 8 },
  methodBadge: { backgroundColor: '#fef3c7', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 },
  methodBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, minWidth: '45%', flex: 1 },
  statLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statValueHighlight: { color: '#16a34a' },
  narrativeBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  narrativeLabel: { fontSize: 11, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  narrativeText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
  allocCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  allocCardPriority: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  allocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  allocName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  allocAmount: { fontSize: 18, fontWeight: '800', color: '#111827' },
  allocSub: { fontSize: 12, fontWeight: '400', color: '#9ca3af' },
  allocTags: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  priorityTag: { backgroundColor: '#dbeafe', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  priorityTagText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  minOnlyText: { fontSize: 11, color: '#9ca3af' },
  allocReason: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
})
