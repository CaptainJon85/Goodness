import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { MainTabParamList } from '../../navigation'
import { api } from '../../lib/api'
import { formatGBP, formatDate, daysUntil, utilisationPct, utilisationColour, aprColour } from '../../lib/format'
import { useAuthStore } from '../../store/auth'
import type { DashboardSummary, CreditCard } from '@clearpath/shared'
import AprBadge from '../../components/shared/AprBadge'
import UtilisationBar from '../../components/shared/UtilisationBar'

type Nav = BottomTabNavigationProp<MainTabParamList>

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [cards, setCards] = useState<CreditCard[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const user = useAuthStore((s) => s.user)
  const navigation = useNavigation<Nav>()

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.dashboard.summary(), api.cards.list()])
      setSummary(s)
      setCards(c)
    } catch (err) {
      console.error('Dashboard load error:', err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function deleteCard(id: string) {
    Alert.alert('Delete card', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await api.cards.delete(id)
          await load()
        },
      },
    ])
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
          <Text style={styles.subheading}>Here's your debt overview</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Cards')}>
          <Text style={styles.addBtnText}>+ Card</Text>
        </TouchableOpacity>
      </View>

      {/* Summary hero card */}
      {summary && (
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total debt</Text>
          <Text style={styles.heroAmount}>{formatGBP(summary.totalDebt)}</Text>
          <Text style={styles.heroSub}>across {summary.cardsCount} card{summary.cardsCount !== 1 ? 's' : ''}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Monthly interest</Text>
              <Text style={styles.heroStatValue}>{formatGBP(summary.monthlyInterestBurn)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Utilisation</Text>
              <Text style={styles.heroStatValue}>{summary.averageUtilisation.toFixed(0)}%</Text>
            </View>
            {summary.projectedPayoffDate && (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Debt-free</Text>
                <Text style={styles.heroStatValue}>
                  {new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(summary.projectedPayoffDate))}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Payment alerts */}
      {summary?.cardsDueSoon && summary.cardsDueSoon.length > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>⚠ Payment due soon</Text>
          {(summary.cardsDueSoon as unknown as Array<{ id: string; nickname: string; paymentDueDate: string; minimumPayment: number }>).map((c) => (
            <Text key={c.id} style={styles.alertText}>
              {c.nickname} — {formatGBP(c.minimumPayment)} due {formatDate(c.paymentDueDate)}
            </Text>
          ))}
        </View>
      )}

      {/* Cards list */}
      <Text style={styles.sectionTitle}>Cards <Text style={styles.sectionSub}>sorted by APR</Text></Text>

      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptyDesc}>Add your first card to start tracking your debt.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Cards')}>
            <Text style={styles.emptyBtnText}>Add a card</Text>
          </TouchableOpacity>
        </View>
      ) : (
        cards.map((card) => {
          const days = daysUntil(card.paymentDueDate as unknown as string)
          const dueSoon = days !== Infinity && days <= 5
          return (
            <View key={card.id} style={styles.cardItem}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}><Text>💳</Text></View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNickname}>{card.nickname}</Text>
                  <Text style={styles.cardSub}>
                    {card.provider ? `${card.provider} · ` : ''}••••{card.lastFour}
                  </Text>
                </View>
                <AprBadge apr={card.apr} />
              </View>

              <View style={styles.cardBalance}>
                <Text style={styles.balanceAmount}>{formatGBP(card.balance)}</Text>
                <Text style={styles.balanceSub}>of {formatGBP(card.creditLimit)}</Text>
              </View>

              <UtilisationBar balance={card.balance} creditLimit={card.creditLimit} />

              {card.paymentDueDate && (
                <View style={[styles.dueTag, dueSoon && styles.dueTagAlert]}>
                  <Text style={[styles.dueTagText, dueSoon && styles.dueTagTextAlert]}>
                    {dueSoon ? '⚠ ' : ''}Due {formatDate(card.paymentDueDate as unknown as string)} · Min {formatGBP(card.minimumPayment)}
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={() => deleteCard(card.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subheading: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 16, background: 'transparent', backgroundColor: '#1d4ed8' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  heroAmount: { color: '#fff', fontSize: 36, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 16 },
  heroStat: {},
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  heroStatValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  alert: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  alertTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  alertText: { color: '#dc2626', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  sectionSub: { color: '#9ca3af', fontWeight: '400' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  cardItem: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardInfo: { flex: 1 },
  cardNickname: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 11, color: '#9ca3af' },
  cardBalance: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  balanceAmount: { fontSize: 22, fontWeight: '800', color: '#111827' },
  balanceSub: { fontSize: 12, color: '#9ca3af' },
  dueTag: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 8 },
  dueTagAlert: { backgroundColor: '#fef2f2' },
  dueTagText: { fontSize: 11, color: '#6b7280' },
  dueTagTextAlert: { color: '#dc2626' },
  deleteBtn: { alignSelf: 'flex-end', marginTop: 8 },
  deleteBtnText: { fontSize: 12, color: '#9ca3af' },
})
