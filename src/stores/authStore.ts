import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, RoleName } from '@/types/auth'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  devApiToken: string | null
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setDevApiToken: (token: string | null) => void
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

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setDevApiToken: (devApiToken) => set({ devApiToken }),
      logout: () => set({ user: null, isAuthenticated: false, devApiToken: null }),

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        return roles.includes(user.role_name as RoleName)
      },
    }),
    {
      name: 'scheduling-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        devApiToken: state.devApiToken,
      }),
    }
  )
)
