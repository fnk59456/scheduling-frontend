import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useCreateEmployee } from '@/hooks/useEmployees'
import { useBranches, useOrganizations } from '@/hooks/useOrganizations'
import type { ContractType } from '@/types/employee'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmployeeFormDialog({ open, onOpenChange }: Props) {
  const createEmployee = useCreateEmployee()
  const { data: orgsData } = useOrganizations()
  const { data: branchesData } = useBranches()

  const organizations = orgsData?.results ?? []
  const branches = branchesData?.results ?? []

  const [form, setForm] = useState({
    username: '', email: '', password: '', first_name: '', last_name: '',
    employee_id: '', organization: '', branch: '', position: '',
    contract_type: 'full_time' as ContractType,
    agreed_hours_per_week: '40', hire_date: '',
  })

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }))

  const filteredBranches = form.organization
    ? branches.filter((b) => b.organization === Number(form.organization))
    : branches

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createEmployee.mutateAsync({
      user: {
        username: form.username,
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
      },
      employee_id: form.employee_id,
      organization: Number(form.organization),
      branch: Number(form.branch),
      position: form.position,
      contract_type: form.contract_type,
      agreed_hours_per_week: Number(form.agreed_hours_per_week),
      hire_date: form.hire_date,
    })
    onOpenChange(false)
    setForm({
      username: '', email: '', password: '', first_name: '', last_name: '',
      employee_id: '', organization: '', branch: '', position: '',
      contract_type: 'full_time', agreed_hours_per_week: '40', hire_date: '',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增員工</DialogTitle>
          <DialogDescription>填寫員工基本資料以建立新的員工帳號</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>姓</Label>
              <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="王" required />
            </div>
            <div className="space-y-1.5">
              <Label>名</Label>
              <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="小明" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>帳號</Label>
            <Input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="使用者帳號" required />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" required />
          </div>

          <div className="space-y-1.5">
            <Label>密碼</Label>
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="設定密碼" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>員工編號</Label>
              <Input value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} placeholder="EMP001" required />
            </div>
            <div className="space-y-1.5">
              <Label>職位</Label>
              <Input value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="護理師" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>機構</Label>
              <Select value={form.organization} onValueChange={(v) => { set('organization', v); set('branch', '') }}>
                <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>分店</Label>
              <Select value={form.branch} onValueChange={(v) => set('branch', v)}>
                <SelectTrigger><SelectValue placeholder="選擇分店" /></SelectTrigger>
                <SelectContent>
                  {filteredBranches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>契約類型</Label>
              <Select value={form.contract_type} onValueChange={(v) => set('contract_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">全職</SelectItem>
                  <SelectItem value="part_time">兼職</SelectItem>
                  <SelectItem value="dispatch">派遣</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>週工時</Label>
              <Input type="number" value={form.agreed_hours_per_week} onChange={(e) => set('agreed_hours_per_week', e.target.value)} min={1} max={168} required />
            </div>
            <div className="space-y-1.5">
              <Label>到職日</Label>
              <Input type="date" value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)} required />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={createEmployee.isPending}>
              {createEmployee.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />建立中...</> : '建立員工'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
