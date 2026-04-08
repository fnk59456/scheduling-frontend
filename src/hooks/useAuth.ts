import { useEffect, useCallback } from 'react'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/endpoints/auth'
import { toast } from '@/hooks/use-toast'

type AuthMode = 'firebase' | 'token'
const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE as AuthMode | undefined) || 'firebase'

export function useAuth() {
  const { user, isAuthenticated, isLoading, devApiToken, setUser, setLoading, setDevApiToken, logout: storeLogout } = useAuthStore()

  useEffect(() => {
    if (AUTH_MODE === 'token') {
      ;(async () => {
        const token = devApiToken
        if (!token) {
          setUser(null)
          setLoading(false)
          return
        }
        try {
          const profile = await authApi.getMe()
          setUser(profile)
        } catch {
          // token 失效或後端拒絕：清理狀態，讓 ProtectedRoute 正常導回登入頁
          setDevApiToken(null)
          setUser(null)
        } finally {
          setLoading(false)
        }
      })()
      return
    }

    if (!auth) {
      setUser(null)
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const profile = await authApi.getMe()
        setUser(profile)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [devApiToken, setDevApiToken, setUser, setLoading])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      if (AUTH_MODE === 'token') {
        const res = await authApi.login({ username: email, password })
        setDevApiToken(res.token)
        setUser(res.user)
        toast({ title: '登入成功', description: `歡迎回來，${res.user.first_name || res.user.username}` })
        return
      }

      if (!auth) throw new Error('Firebase 未初始化（請檢查 VITE_AUTH_MODE / Firebase env）')
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
  }, [setDevApiToken, setUser, setLoading])

  const logout = useCallback(async () => {
    try {
      if (AUTH_MODE === 'token') {
        setDevApiToken(null)
        storeLogout()
        toast({ title: '已登出', description: '您已安全登出系統' })
        return
      }

      if (!auth) {
        storeLogout()
        return
      }
      await signOut(auth)
      storeLogout()
      toast({ title: '已登出', description: '您已安全登出系統' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登出時發生錯誤'
      toast({ title: '登出失敗', description: message, variant: 'destructive' })
    }
  }, [setDevApiToken, storeLogout])

  return { user, isAuthenticated, isLoading, login, logout }
}
