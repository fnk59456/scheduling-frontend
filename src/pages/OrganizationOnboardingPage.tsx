import { useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/BrandLogo'
import { organizationsApi } from '@/api/endpoints/organizations'
import { authApi } from '@/api/endpoints/auth'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/hooks/use-toast'
import { parseApiErrorMessage } from '@/api/errors'

export default function OrganizationOnboardingPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await organizationsApi.create({ name: name.trim() })
      const profile = await authApi.getMe()
      setUser(profile)
      toast({ title: '機構建立完成', description: '接著可建立分店、員工與班別。' })
      navigate('/settings/organizations', { replace: true })
    } catch (error) {
      toast({
        title: '建立機構失敗',
        description: parseApiErrorMessage(error, '請稍後重試'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="items-center text-center">
          <BrandLogo className="mb-2 h-16 w-16 rounded-2xl" />
          <CardTitle className="text-2xl">建立您的機構</CardTitle>
          <CardDescription>
            這是新帳號的最後一步。建立後，此帳號會自動綁定至該機構。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="organization-name">機構名稱</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="organization-name"
                  className="pl-9"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例：小天使照護中心"
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">機構代碼將由系統自動產生。</p>
            </div>
            <Button className="w-full" type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              建立並進入系統
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
