import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { aprColour } from '../../lib/format'

export default function AprBadge({ apr }: { apr: number }) {
  const colour = aprColour(apr)
  return (
    <View style={[styles.badge, { backgroundColor: colour + '20', borderColor: colour + '40' }]}>
      <Text style={[styles.text, { color: colour }]}>{apr.toFixed(1)}% APR</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
})
