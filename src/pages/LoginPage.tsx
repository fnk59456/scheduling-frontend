import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'

const BYPASS_AUTH = String(import.meta.env.VITE_BYPASS_AUTH || '').toLowerCase() === 'true'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const { login, loginWithGoogle, googleLoginAvailable, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [from, isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch {
      // error handled in useAuth
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleSubmitting(true)
    try {
      const profile = await loginWithGoogle()
      if (profile) navigate(from, { replace: true })
    } catch {
      // error handled in useAuth
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo className="h-20 w-20 rounded-3xl shadow-lg ring-1 ring-border/60" />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">AI 智慧排班系統</h1>
            <p className="text-muted-foreground mt-1">智慧排班・合規管理・高效營運</p>
          </div>
        </div>

        <Card className="shadow-xl border-primary/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">登入</CardTitle>
            <CardDescription className="text-center">
              使用 Google 或系統帳號登入
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="mb-4 h-11 w-full text-base"
              onClick={handleGoogleLogin}
              disabled={!googleLoginAvailable || isGoogleSubmitting || isSubmitting}
              title={googleLoginAvailable ? undefined : '尚未設定 Firebase 環境變數'}
            >
              {isGoogleSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="mr-2 h-5 w-5" />
              )}
              使用 Google 登入
            </Button>

            {!googleLoginAvailable && (
              <p className="mb-4 text-center text-xs text-muted-foreground">
                Google 登入尚未完成環境設定，目前可使用系統帳號登入。
              </p>
            )}

            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              或使用系統帳號
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">帳號</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="請輸入帳號"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="輸入密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={isSubmitting || isGoogleSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登入中...
                  </>
                ) : (
                  '登入'
                )}
              </Button>

              {BYPASS_AUTH ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => navigate('/dashboard', { replace: true })}
                >
                  以示範模式進入（跳過登入）
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          AI 智慧排班系統 &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  )
}
