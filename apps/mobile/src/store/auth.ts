import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../lib/api'

interface AuthUser {
  id: string
  email: string
  name: string
  subscriptionTier: 'free' | 'plus' | 'premium'
  kycStatus?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  hydrated: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  hydrated: false,

  hydrate: async () => {
    const token = await AsyncStorage.getItem('clearpath_token')
    if (token) {
      set({ token })
      try {
        const user = await api.auth.me()
        set({ user: user as AuthUser, hydrated: true })
      } catch {
        await AsyncStorage.removeItem('clearpath_token')
        set({ token: null, user: null, hydrated: true })
      }
    } else {
      set({ hydrated: true })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const data = await api.auth.login(email, password)
      await AsyncStorage.setItem('clearpath_token', data.token)
      set({ token: data.token, user: data.user as AuthUser, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true })
    try {
      const data = await api.auth.register(email, password, name)
      await AsyncStorage.setItem('clearpath_token', data.token)
      set({ token: data.token, user: data.user as AuthUser, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('clearpath_token')
    set({ user: null, token: null })
  },

  refreshUser: async () => {
    try {
      const user = await api.auth.me()
      set({ user: user as AuthUser })
    } catch {
      get().logout()
    }
  },
}))
