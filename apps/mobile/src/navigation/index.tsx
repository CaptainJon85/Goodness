import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { useAuthStore } from '../store/auth'

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'

// Main screens
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import CardsScreen from '../screens/cards/CardsScreen'
import AddCardScreen from '../screens/cards/AddCardScreen'
import RepaymentScreen from '../screens/repayment/RepaymentScreen'
import CreditScoreScreen from '../screens/creditScore/CreditScoreScreen'
import VirtualCardScreen from '../screens/virtualCard/VirtualCardScreen'
import SettingsScreen from '../screens/dashboard/SettingsScreen'

export type RootStackParamList = {
  Auth: undefined
  Main: undefined
  AddCard: undefined
}

export type AuthStackParamList = {
  Login: undefined
  Register: undefined
}

export type MainTabParamList = {
  Dashboard: undefined
  Cards: undefined
  Repayment: undefined
  CreditScore: undefined
  VirtualCard: undefined
  Settings: undefined
}

const RootStack = createNativeStackNavigator<RootStackParamList>()
const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const MainTab   = createBottomTabNavigator<MainTabParamList>()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '🏠', Cards: '💳', Repayment: '📉', CreditScore: '⭐', VirtualCard: '💎', Settings: '⚙️',
  }
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icons[name] ?? '•'}</Text>
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  )
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <MainTab.Screen name="Dashboard" component={DashboardScreen} />
      <MainTab.Screen name="Cards" component={CardsScreen} />
      <MainTab.Screen name="Repayment" component={RepaymentScreen} />
      <MainTab.Screen name="CreditScore" component={CreditScoreScreen} options={{ tabBarLabel: 'Score' }} />
      <MainTab.Screen name="VirtualCard" component={VirtualCardScreen} options={{ tabBarLabel: 'Card' }} />
      <MainTab.Screen name="Settings" component={SettingsScreen} />
    </MainTab.Navigator>
  )
}

export default function AppNavigator() {
  const token = useAuthStore((s) => s.token)
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
