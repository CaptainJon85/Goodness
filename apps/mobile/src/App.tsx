import React, { useEffect } from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from './store/auth'
import AppNavigator from './navigation'
import LoadingScreen from './components/shared/LoadingScreen'

export default function App() {
  const { hydrated, hydrate } = useAuthStore()

  useEffect(() => { hydrate() }, [hydrate])

  if (!hydrated) return <LoadingScreen />

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <AppNavigator />
    </SafeAreaProvider>
  )
}
