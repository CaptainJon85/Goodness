import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '../../store/auth'

const TIER_RANK: Record<string, number> = { free: 0, plus: 1, premium: 2 }

interface Props {
  requiredTier: 'plus' | 'premium'
  children: React.ReactNode
  onUpgrade?: () => void
}

export default function FeatureGate({ requiredTier, children, onUpgrade }: Props) {
  const user = useAuthStore((s) => s.user)
  const rank = TIER_RANK[user?.subscriptionTier ?? 'free']
  if (rank >= TIER_RANK[requiredTier]) return <>{children}</>

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>{requiredTier === 'premium' ? 'Premium' : 'Plus'} feature</Text>
      <Text style={styles.desc}>
        Upgrade to {requiredTier === 'premium' ? 'Premium (£9.99/mo)' : 'Plus (£4.99/mo)'} to unlock this.
      </Text>
      {onUpgrade && (
        <TouchableOpacity style={styles.btn} onPress={onUpgrade}>
          <Text style={styles.btnText}>Upgrade now</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e5e7eb', margin: 16 },
  icon: { fontSize: 32, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  desc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
