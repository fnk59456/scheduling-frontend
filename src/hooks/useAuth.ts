import { useEffect, useCallback } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/endpoints/auth'
import { queryClient } from '@/api/queryClient'
import { toast } from '@/hooks/use-toast'
import { isAxiosError } from 'axios'
import { parseApiErrorMessage } from '@/api/errors'

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    devApiToken,
    setUser,
    setLoading,
    setDevApiToken,
    setAuthMethod,
    logout: storeLogout,
  } = useAuthStore()

  useEffect(() => {
    let disposed = false

    const loadTokenProfile = async () => {
      if (!devApiToken) {
        if (!disposed) {
          setAuthMethod(null)
          setUser(null)
          setLoading(false)
        }
        return
      }
      try {
        setAuthMethod('token')
        const profile = await authApi.getMe()
        if (!disposed) setUser(profile)
      } catch {
        if (!disposed) {
          setDevApiToken(null)
          setAuthMethod(null)
          setUser(null)
        }
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    if (!auth) {
      void loadTokenProfile()
      return () => { disposed = true }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setAuthMethod('firebase')
          if (devApiToken) setDevApiToken(null)
          const profile = await authApi.getMe()
          if (!disposed) setUser(profile)
        } catch {
          if (!disposed) {
            setAuthMethod(null)
            setUser(null)
          }
        } finally {
          if (!disposed) setLoading(false)
        }
        return
      }

      await loadTokenProfile()
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [devApiToken, setAuthMethod, setDevApiToken, setUser, setLoading])

  const login = useCallback(async (username: string, password: string) => {
    try {
      setLoading(true)
      if (auth?.currentUser) await signOut(auth)
      queryClient.clear()
      setDevApiToken(null)
      setAuthMethod(null)

      const res = await authApi.login({ username, password })
      setDevApiToken(res.token)
      setAuthMethod('token')
      setUser(res.user)
      toast({ title: '登入成功', description: `歡迎回來，${res.user.first_name || res.user.username}` })
    } catch (error: unknown) {
      const message = isAxiosError(error)
        ? error.response
          ? parseApiErrorMessage(error, '登入失敗，請檢查帳號密碼')
          : '無法連線後端，請確認 API 網址與 CORS 設定'
        : error instanceof Error
          ? error.message
          : '登入失敗，請檢查帳號密碼'
      toast({ title: '登入失敗', description: message, variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [setAuthMethod, setDevApiToken, setUser, setLoading])

  const loginWithGoogle = useCallback(async () => {
    if (!auth || !isFirebaseConfigured) {
      const error = new Error('Google 登入尚未設定，請聯絡系統管理員')
      toast({ title: '無法使用 Google 登入', description: error.message, variant: 'destructive' })
      throw error
    }

    try {
      setLoading(true)
      queryClient.clear()
      setDevApiToken(null)
      setAuthMethod('firebase')

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)

      const profile = await authApi.getMe()
      setUser(profile)
      toast({ title: 'Google 登入成功', description: `歡迎，${profile.first_name || profile.username}` })
      return profile
    } catch (error: unknown) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''

      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, new GoogleAuthProvider())
        return null
      }

      const message = code === 'auth/popup-closed-by-user'
        ? '已取消 Google 登入'
        : isAxiosError(error)
          ? parseApiErrorMessage(error, 'Google 帳號無法登入系統')
          : error instanceof Error
            ? error.message
            : 'Google 登入失敗'
      toast({ title: 'Google 登入失敗', description: message, variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [setAuthMethod, setDevApiToken, setUser, setLoading])

  const logout = useCallback(async () => {
    try {
      if (auth?.currentUser) await signOut(auth)
      queryClient.clear()
      storeLogout()
      toast({ title: '已登出', description: '您已安全登出系統' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登出時發生錯誤'
      toast({ title: '登出失敗', description: message, variant: 'destructive' })
    }
  }, [storeLogout])

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    loginWithGoogle,
    logout,
    googleLoginAvailable: isFirebaseConfigured,
  }
}
