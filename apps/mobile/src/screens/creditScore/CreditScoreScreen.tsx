import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { api } from '../../lib/api'
import type { ScoreFactor } from '@clearpath/shared'
import FeatureGate from '../../components/shared/FeatureGate'

interface ScoreData {
  score: number; band: string; provider: string; recordedAt: string
  factors?: ScoreFactor[]
}

interface Projection {
  currentScore: number | null; projectedScore: number | null
  estimatedScoreGain: number; currentUtilisation: number; payoffMonths: number | null
}

const BAND_COLOUR: Record<string, string> = {
  excellent: '#16a34a', good: '#2563eb', fair: '#d97706', poor: '#dc2626',
}

export default function CreditScoreScreen() {
  const [score, setScore] = useState<ScoreData | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', postcode: '', addressLine1: '' })

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      api.creditScore.latest().catch(() => null),
      api.creditScore.projection().catch(() => null),
    ])
    setScore(s)
    setProjection(p)
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function handleFetch() {
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.postcode || !form.addressLine1) {
      Alert.alert('Error', 'Please fill in all fields'); return
    }
    setFetching(true)
    try {
      await api.creditScore.fetch(form)
      setShowForm(false)
      await load()
    } catch (err) {
      Alert.alert('Error', (err as Error).message)
    } finally { setFetching(false) }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>

  const colour = BAND_COLOUR[score?.band ?? 'poor'] ?? '#374151'

  return (
    <FeatureGate requiredTier="plus">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Credit Score</Text>
            <Text style={styles.subtitle}>Powered by Experian</Text>
          </View>
          <TouchableOpacity style={styles.fetchBtn} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.fetchBtnText}>{score ? 'Refresh' : 'Get score'}</Text>
          </TouchableOpacity>
        </View>

        {/* Experian form */}
        {showForm && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pull score from Experian</Text>
            <Text style={styles.formNote}>Soft check only — won't affect your score.</Text>
            {(['firstName', 'lastName', 'dateOfBirth', 'postcode', 'addressLine1'] as const).map((key) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={styles.label}>{key === 'dateOfBirth' ? 'Date of birth (YYYY-MM-DD)' : key === 'addressLine1' ? 'Address line 1' : key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <TextInput style={styles.input} value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))} placeholder={key === 'dateOfBirth' ? '1990-01-25' : key === 'postcode' ? 'SW1A 1AA' : ''} autoCapitalize="words" />
              </View>
            ))}
            <TouchableOpacity style={[styles.btn, fetching && styles.btnDisabled]} onPress={handleFetch} disabled={fetching}>
              {fetching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Get my score</Text>}
            </TouchableOpacity>
          </View>
        )}

        {score ? (
          <>
            {/* Score display */}
            <View style={[styles.card, styles.scoreCard]}>
              <Text style={[styles.scoreNumber, { color: colour }]}>{score.score}</Text>
              <Text style={[styles.scoreBand, { color: colour }]}>{score.band.charAt(0).toUpperCase() + score.band.slice(1)}</Text>
              <Text style={styles.scoreMax}>out of 999 · Experian</Text>
            </View>

            {/* Projection */}
            {projection?.currentScore != null && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>📈 Score projection</Text>
                <View style={styles.projRow}>
                  <View style={styles.projStat}>
                    <Text style={styles.projLabel}>Today</Text>
                    <Text style={styles.projValue}>{projection.currentScore}</Text>
                  </View>
                  <Text style={styles.projArrow}>→</Text>
                  <View style={styles.projStat}>
                    <Text style={[styles.projLabel, { color: '#16a34a' }]}>After plan</Text>
                    <Text style={[styles.projValue, { color: '#16a34a' }]}>
                      {projection.projectedScore ?? '—'}
                      {projection.estimatedScoreGain > 0 && ` (+${projection.estimatedScoreGain})`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.projNote}>Estimated based on utilisation reduction. Actual scores vary.</Text>
              </View>
            )}

            {/* Factors */}
            {score.factors && score.factors.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Score factors</Text>
                {score.factors.filter((f) => f.type === 'positive').length > 0 && (
                  <>
                    <Text style={styles.factorGroupLabel}>✅ Helping</Text>
                    {score.factors.filter((f) => f.type === 'positive').map((f, i) => (
                      <FactorRow key={i} factor={f} />
                    ))}
                  </>
                )}
                {score.factors.filter((f) => f.type === 'negative').length > 0 && (
                  <>
                    <Text style={[styles.factorGroupLabel, { color: '#dc2626' }]}>⚠ Hurting</Text>
                    {score.factors.filter((f) => f.type === 'negative').map((f, i) => (
                      <FactorRow key={i} factor={f} />
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        ) : !showForm ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No score data yet</Text>
            <Text style={styles.emptyDesc}>Tap "Get score" to pull your Experian score. It's a soft check — no impact on your score.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setShowForm(true)}>
              <Text style={styles.btnText}>Get my credit score</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </FeatureGate>
  )
}

function FactorRow({ factor }: { factor: ScoreFactor }) {
  const impact = factor.impact === 'high' ? '●●●' : factor.impact === 'medium' ? '●●○' : '●○○'
  return (
    <View style={styles.factorRow}>
      <Text style={styles.factorText} numberOfLines={2}>{factor.description}</Text>
      <Text style={styles.factorImpact}>{impact}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  fetchBtn: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  fetchBtnText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  scoreCard: { alignItems: 'center', paddingVertical: 28 },
  scoreNumber: { fontSize: 72, fontWeight: '900' },
  scoreBand: { fontSize: 22, fontWeight: '700', marginTop: -4 },
  scoreMax: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  formNote: { fontSize: 12, color: '#6b7280', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  projRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  projStat: {},
  projLabel: { fontSize: 11, color: '#6b7280' },
  projValue: { fontSize: 26, fontWeight: '800', color: '#111827' },
  projArrow: { fontSize: 20, color: '#d1d5db', flex: 1, textAlign: 'center' },
  projNote: { fontSize: 11, color: '#9ca3af' },
  factorGroupLabel: { fontSize: 12, fontWeight: '700', color: '#16a34a', marginBottom: 6, marginTop: 4 },
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  factorText: { fontSize: 13, color: '#374151', flex: 1, paddingRight: 8 },
  factorImpact: { fontSize: 11, color: '#9ca3af', letterSpacing: 2 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
})
