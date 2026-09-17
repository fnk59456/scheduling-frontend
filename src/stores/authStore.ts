import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, RoleName } from '@/types/auth'

export type AuthMethod = 'firebase' | 'token' | null

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  devApiToken: string | null
  authMethod: AuthMethod
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setDevApiToken: (token: string | null) => void
  setAuthMethod: (method: AuthMethod) => void
  logout: () => void
  hasRole: (roles: RoleName[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      devApiToken: null,
      authMethod: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setDevApiToken: (devApiToken) => set({ devApiToken }),
      setAuthMethod: (authMethod) => set({ authMethod }),
      logout: () => set({ user: null, isAuthenticated: false, devApiToken: null, authMethod: null }),

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        if (!user.role_name) return true  // superuser / no role assigned = full access
        return roles.includes(user.role_name as RoleName)
      },
    }),
    {
      name: 'scheduling-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        devApiToken: state.devApiToken,
        authMethod: state.authMethod,
      }),
    }
  )
)
