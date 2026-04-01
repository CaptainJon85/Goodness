import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { utilisationPct, utilisationColour } from '../../lib/format'

interface Props { balance: number; creditLimit: number }

export default function UtilisationBar({ balance, creditLimit }: Props) {
  const pct = utilisationPct(balance, creditLimit)
  const colour = utilisationColour(pct)
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{pct.toFixed(0)}% used</Text>
        {creditLimit > 0 && <Text style={styles.label}>£{(creditLimit / 100).toFixed(0)} limit</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: colour }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 11, color: '#6b7280' },
  track: { height: 6, borderRadius: 99, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 99 },
})
