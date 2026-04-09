import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const data = await api.auth.login(email, password)
          localStorage.setItem('clearpath_token', data.token)
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
          localStorage.setItem('clearpath_token', data.token)
          set({ token: data.token, user: data.user as AuthUser, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('clearpath_token')
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
    }),
    {
      name: 'clearpath-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
