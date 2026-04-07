import { useEffect, useCallback } from 'react'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/endpoints/auth'
import { toast } from '@/hooks/use-toast'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: storeLogout } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await authApi.getMe()
          setUser(profile)
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [setUser, setLoading])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      await signInWithEmailAndPassword(auth, email, password)
      const profile = await authApi.getMe()
      setUser(profile)
      toast({ title: '登入成功', description: `歡迎回來，${profile.first_name || profile.username}` })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登入失敗，請檢查帳號密碼'
      toast({ title: '登入失敗', description: message, variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [setUser, setLoading])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
      storeLogout()
      toast({ title: '已登出', description: '您已安全登出系統' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登出時發生錯誤'
      toast({ title: '登出失敗', description: message, variant: 'destructive' })
    }
  }, [storeLogout])

  return { user, isAuthenticated, isLoading, login, logout }
}
