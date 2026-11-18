import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useCreateEmployee, useDeleteEmployee, useUpdateEmployee } from '@/hooks/useEmployees'
import { useBranches, useOrganizations } from '@/hooks/useOrganizations'
import type { ContractType, Employee, PayType } from '@/types/employee'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee
  onDeleted?: () => void
}

const emptyForm = {
  username: '', email: '', password: '', first_name: '', last_name: '',
  employee_id: '', organization: '', branch: '', position: '',
  contract_type: 'full_time' as ContractType,
  pay_type: 'monthly' as PayType,
  agreed_hours_per_week: '40', hire_date: '',
}

// 後端拒收早於 1950-01-01 的到職日（擋民國年誤輸入）；上限放到一年後，容許預先建檔
const HIRE_DATE_MIN = '1950-01-01'

function hireDateMax() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 原生 date input 打民國年（110）會得到西元 0110 年；年份 < 1911 視為民國年並換算 */
function convertRocHireDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  if (year <= 0 || year >= 1911) return null
  return { rocYear: year, value: `${year + 1911}-${match[2]}-${match[3]}` }
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onDeleted }: Props) {
  const isEdit = !!employee
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()
  const {
    data: orgsData,
    isLoading: orgsLoading,
    isError: orgsIsError,
    error: orgsError,
  } = useOrganizations()
  const {
    data: branchesData,
    isLoading: branchesLoading,
    isError: branchesIsError,
    error: branchesError,
  } = useBranches()

  const organizations = orgsData?.results ?? []
  const branches = branchesData?.results ?? []

  const [form, setForm] = useState(emptyForm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [hireDateNote, setHireDateNote] = useState('')

  useEffect(() => {
    if (!open) return
    setHireDateNote('')

    if (!employee) {
      setForm(emptyForm)
      return
    }

    setForm({
      username: employee.user.username ?? '',
      email: employee.user.email ?? '',
      password: '',
      first_name: employee.user.first_name ?? '',
      last_name: employee.user.last_name ?? '',
      employee_id: employee.employee_id ?? '',
      organization: employee.organization ? String(employee.organization) : '',
      branch: employee.branch ? String(employee.branch) : '',
      position: employee.position ?? '',
      contract_type: employee.contract_type,
      pay_type: employee.pay_type ?? 'monthly',
      agreed_hours_per_week: String(employee.agreed_hours_per_week ?? '40'),
      hire_date: employee.hire_date ?? '',
    })
  }, [open, employee])

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }))

  // 逐字輸入年份時（2→20→202→2021）中途值也會 < 1911，所以等離開欄位才換算
  const normalizeHireDate = () => {
    const converted = convertRocHireDate(form.hire_date)
    if (!converted) return
    set('hire_date', converted.value)
    setHireDateNote(`已將民國 ${converted.rocYear} 年換算為西元 ${converted.value.replace(/-/g, '/')}，請確認`)
  }

  const filteredBranches = form.organization
    ? branches.filter((b) => b.organization === Number(form.organization))
    : branches

  const ORG_LOADING_VALUE = '__org_loading__'
  const ORG_EMPTY_VALUE = '__org_empty__'
  const BRANCH_LOADING_VALUE = '__branch_loading__'
  const BRANCH_EMPTY_VALUE = '__branch_empty__'

  const selectOrg = (v: string) => {
    if (v === ORG_LOADING_VALUE || v === ORG_EMPTY_VALUE) return
    set('organization', v)
    set('branch', '')
  }

  const selectBranch = (v: string) => {
    if (v === BRANCH_LOADING_VALUE || v === BRANCH_EMPTY_VALUE) return
    set('branch', v)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userPayload: any = {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
    }
    if (!isEdit || form.password) userPayload.password = form.password

    const payload: any = {
      user: userPayload,
      employee_id: form.employee_id,
      position: form.position,
      contract_type: form.contract_type,
      pay_type: form.pay_type,
      agreed_hours_per_week: Number(form.agreed_hours_per_week),
      hire_date: form.hire_date,
    }

    // 依使用情境先放寬為選填，避免前端流程被擋住
    if (form.organization) payload.organization = Number(form.organization)
    if (form.branch) payload.branch = Number(form.branch)

    if (isEdit && employee) {
      await updateEmployee.mutateAsync({ id: employee.id, data: payload })
    } else {
      await createEmployee.mutateAsync(payload)
    }
    onOpenChange(false)
    setForm(emptyForm)
  }

  const openDeleteConfirm = () => {
    onOpenChange(false)
    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    onOpenChange(true)
  }

  const handleDelete = async () => {
    if (!employee) return
    await deleteEmployee.mutateAsync(employee.id)
    setShowDeleteConfirm(false)
    onDeleted?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? '編輯員工' : '新增員工'}</DialogTitle>
          <DialogDescription>{isEdit ? '更新員工基本資料與帳號設定' : '填寫員工基本資料以建立新的員工帳號'}</DialogDescription>
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
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={isEdit ? '留空則不變更密碼' : '設定密碼'} required={!isEdit} />
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
              <Label>機構（選填）</Label>
              <Select value={form.organization} onValueChange={selectOrg} disabled={orgsLoading}>
                <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                <SelectContent>
                  {orgsLoading ? (
                    <SelectItem value={ORG_LOADING_VALUE} disabled>載入中...</SelectItem>
                  ) : organizations.length === 0 ? (
                    <SelectItem value={ORG_EMPTY_VALUE} disabled>尚未建立任何機構</SelectItem>
                  ) : (
                    organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              {orgsIsError && (
                <p className="text-xs text-destructive mt-1">
                  無法載入機構清單：{(orgsError as any)?.message || '請確認登入狀態與後端服務'}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>分店（選填）</Label>
              <Select
                value={form.branch}
                onValueChange={selectBranch}
                disabled={branchesLoading || filteredBranches.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="選擇分店" /></SelectTrigger>
                <SelectContent>
                  {branchesLoading ? (
                    <SelectItem value={BRANCH_LOADING_VALUE} disabled>載入中...</SelectItem>
                  ) : filteredBranches.length === 0 ? (
                    <SelectItem value={BRANCH_EMPTY_VALUE} disabled>此機構尚未建立分店</SelectItem>
                  ) : (
                    filteredBranches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              {branchesIsError && (
                <p className="text-xs text-destructive mt-1">
                  無法載入分店清單：{(branchesError as any)?.message || '請確認登入狀態與後端服務'}
                </p>
              )}
            </div>
          </div>

          {/* 兩欄 × 兩列：四欄並排時到職日太窄，日曆圖示會被擠掉 */}
          <div className="grid grid-cols-2 gap-3">
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
              <Label>薪制</Label>
              <Select value={form.pay_type} onValueChange={(v) => set('pay_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">月薪制</SelectItem>
                  <SelectItem value="hourly">時薪制</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>週工時</Label>
              <Input type="number" value={form.agreed_hours_per_week} onChange={(e) => set('agreed_hours_per_week', e.target.value)} min={1} max={168} required />
            </div>
            <div className="space-y-1.5">
              <Label>
                到職日 <span className="text-xs font-normal text-muted-foreground">西元年，例如 2021/01/01</span>
              </Label>
              <Input
                type="date"
                value={form.hire_date}
                onChange={(e) => {
                  set('hire_date', e.target.value)
                  setHireDateNote('')
                }}
                onBlur={normalizeHireDate}
                min={HIRE_DATE_MIN}
                max={hireDateMax()}
                required
              />
              {hireDateNote && <p className="text-xs text-amber-700">{hireDateNote}</p>}
            </div>
          </div>

          <DialogFooter className={isEdit ? 'sm:justify-between' : undefined}>
            {isEdit && (
              <Button type="button" variant="destructive" onClick={openDeleteConfirm}>
                <Trash2 className="mr-2 h-4 w-4" />刪除員工
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending}>
                {createEmployee.isPending || updateEmployee.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />處理中...</> : isEdit ? '儲存變更' : '建立員工'}
              </Button>
            </div>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>確定要刪除員工？</DialogTitle>
            <DialogDescription>
              將永久刪除 {employee ? `${employee.user.last_name}${employee.user.first_name}（${employee.employee_id}）` : '此員工'}，並一併移除登入帳號、排班、請假、契約及其他關聯歷史。此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={deleteEmployee.isPending}>返回編輯</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEmployee.isPending}>
              {deleteEmployee.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
