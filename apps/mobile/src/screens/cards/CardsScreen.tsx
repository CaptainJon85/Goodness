import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'

interface CardFormData {
  nickname: string; lastFour: string; provider: string
  balance: string; creditLimit: string; apr: string
  minimumPayment: string; paymentDueDate: string
}

const EMPTY: CardFormData = { nickname: '', lastFour: '', provider: '', balance: '', creditLimit: '', apr: '', minimumPayment: '', paymentDueDate: '' }

export default function CardsScreen() {
  const [form, setForm] = useState<CardFormData>(EMPTY)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const user = useAuthStore((s) => s.user)

  function field(key: keyof CardFormData) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    const balance = Math.round(parseFloat(form.balance) * 100)
    const creditLimit = Math.round(parseFloat(form.creditLimit) * 100)
    const apr = parseFloat(form.apr)
    const minimumPayment = Math.round(parseFloat(form.minimumPayment || '0') * 100)

    if (!form.nickname || !form.lastFour || isNaN(balance) || isNaN(creditLimit) || isNaN(apr)) {
      Alert.alert('Validation error', 'Please fill in all required fields.')
      return
    }
    if (form.lastFour.length !== 4 || !/^\d{4}$/.test(form.lastFour)) {
      Alert.alert('Validation error', 'Last 4 digits must be exactly 4 numbers.')
      return
    }
    if (balance > creditLimit) { Alert.alert('Validation error', 'Balance cannot exceed credit limit.'); return }
    if (apr <= 0) { Alert.alert('Validation error', 'APR must be greater than 0.'); return }

    setIsLoading(true)
    try {
      await api.cards.createManual({ nickname: form.nickname, lastFour: form.lastFour, provider: form.provider, balance, creditLimit, apr, minimumPayment, paymentDueDate: form.paymentDueDate || null })
      setForm(EMPTY)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const e = err as Error & { code?: string }
      if (e.code === 'TIER_REQUIRED') {
        Alert.alert('Upgrade required', 'Free tier allows up to 2 cards. Upgrade to Plus for unlimited cards.')
      } else {
        Alert.alert('Error', e.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add a card</Text>
        <Text style={styles.subtitle}>Enter your card details manually</Text>

        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✅ Card saved successfully!</Text>
          </View>
        )}

        <View style={styles.card}>
          <Field label="Card nickname *" value={form.nickname} onChange={field('nickname')} placeholder="e.g. Barclaycard Rewards" />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field label="Last 4 digits *" value={form.lastFour} onChange={field('lastFour')} placeholder="1234" maxLength={4} keyboardType="number-pad" />
            </View>
            <View style={styles.halfField}>
              <Field label="Provider" value={form.provider} onChange={field('provider')} placeholder="e.g. Barclays" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field label="Balance (£) *" value={form.balance} onChange={field('balance')} placeholder="1234.56" keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfField}>
              <Field label="Credit limit (£) *" value={form.creditLimit} onChange={field('creditLimit')} placeholder="5000.00" keyboardType="decimal-pad" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Field label="APR (%) *" value={form.apr} onChange={field('apr')} placeholder="26.4" keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfField}>
              <Field label="Min payment (£) *" value={form.minimumPayment} onChange={field('minimumPayment')} placeholder="25.00" keyboardType="decimal-pad" />
            </View>
          </View>
          <Field label="Payment due date (YYYY-MM-DD)" value={form.paymentDueDate} onChange={field('paymentDueDate')} placeholder="2026-05-25" />

          <TouchableOpacity style={[styles.btn, isLoading && styles.btnDisabled]} onPress={handleSave} disabled={isLoading}>
            <Text style={styles.btnText}>{isLoading ? 'Saving…' : 'Save card'}</Text>
          </TouchableOpacity>
        </View>

        {user?.subscriptionTier === 'free' && (
          <View style={styles.tierNote}>
            <Text style={styles.tierNoteText}>Free plan: up to 2 cards. <Text style={{ color: '#2563eb' }}>Upgrade for unlimited →</Text></Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field({ label, value, onChange, placeholder, maxLength, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; keyboardType?: any
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} maxLength={maxLength} keyboardType={keyboardType ?? 'default'} placeholderTextColor="#9ca3af" />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  successBanner: { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  successText: { color: '#15803d', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  row: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#fff' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  tierNote: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginTop: 12 },
  tierNoteText: { fontSize: 13, color: '#1d4ed8' },
})
