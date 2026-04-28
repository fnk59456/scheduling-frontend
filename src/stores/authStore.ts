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
      // 注意：這是開發/驗收用 token（VITE_AUTH_MODE=token 時使用）
      // 若要避免寫死在程式碼，建議改成從環境變數或登入流程寫入。
      devApiToken: '8eea3ddbf32a86283da70f6c4cad8c64b749e67d',

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setDevApiToken: (devApiToken) => set({ devApiToken }),
      logout: () => set({ user: null, isAuthenticated: false, devApiToken: null }),

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
      }),
    }
  )
)
