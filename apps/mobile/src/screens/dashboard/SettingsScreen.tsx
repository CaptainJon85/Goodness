import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'Permanently delete your account and all data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await api.auth.deleteAccount()
              logout()
            } catch (err) {
              Alert.alert('Error', (err as Error).message)
            }
          },
        },
      ]
    )
  }

  const tierBadge: Record<string, string> = { free: '🆓 Free', plus: '⭐ Plus', premium: '💎 Premium' }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Name</Text>
          <Text style={styles.rowValue}>{user?.name || '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Plan</Text>
          <Text style={styles.rowValue}>{tierBadge[user?.subscriptionTier ?? 'free']}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <Text style={styles.sectionDesc}>Manage your ClearPath subscription via the web app at clearpath.app/pricing</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => Linking.openURL('https://clearpath.app/pricing')}>
          <Text style={styles.outlineBtnText}>View plans</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.dangerDesc}>Permanently removes your account and all associated data. Cannot be undone.</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete my account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>ClearPath v0.1.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: '#6b7280' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#f3f4f6' },
  outlineBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  logoutBtn: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  dangerSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: '#b91c1c', marginBottom: 4 },
  dangerDesc: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  deleteBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  deleteText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  version: { textAlign: 'center', fontSize: 12, color: '#9ca3af' },
})
