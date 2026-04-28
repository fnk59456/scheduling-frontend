import { useEffect, useState } from 'react'
import { Plus, Clock, Users, Loader2, Pencil, Trash2, ChevronUp, ChevronDown, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useShiftTemplates, useCreateShiftTemplate, useUpdateShiftTemplate, useDeleteShiftTemplate } from '@/hooks/useShifts'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useEmployees } from '@/hooks/useEmployees'
import { shiftTemplatesApi } from '@/api/endpoints/shifts'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ShiftTemplate, ShiftEmployeePriority } from '@/types/shift'

const SHIFT_COLORS = [
  { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'text-sky-500',    title: 'text-sky-700'    },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-500',  title: 'text-amber-700'  },
  { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-500', title: 'text-violet-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-500', title: 'text-indigo-700' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'text-rose-500',   title: 'text-rose-700'   },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',icon: 'text-emerald-500',title: 'text-emerald-700'},
]

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-teal-500', 'bg-indigo-500', 'bg-gray-500',
]

export default function ShiftTemplatesPage() {
  const { data, isLoading } = useShiftTemplates()
  const { data: orgsData } = useOrganizations()
  const createTemplate = useCreateShiftTemplate()
  const updateTemplate = useUpdateShiftTemplate()
  const deleteTemplate = useDeleteShiftTemplate()

  const templates = data?.results ?? []
  const organizations = orgsData?.results ?? []

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<ShiftTemplate | null>(null)
  const [form, setForm] = useState({ organization: '', name: '', start_time: '', end_time: '', break_minutes: '30', overlap_minutes: '0', min_staff_count: '1' })

  // --- 員工優先順序 Dialog ---
  const [priorityShift, setPriorityShift] = useState<ShiftTemplate | null>(null)
  const [priorityItems, setPriorityItems] = useState<ShiftEmployeePriority[]>([])
  const [priorityLoading, setPriorityLoading] = useState(false)
  const [prioritySaving, setPrioritySaving] = useState(false)
  const [addEmployeeId, setAddEmployeeId] = useState<string>('')

  const { data: employeesData } = useEmployees({ is_active: true })
  const activeEmployees = employeesData?.results ?? []

  const openPriorityDialog = async (t: ShiftTemplate) => {
    setPriorityShift(t)
    setPriorityLoading(true)
    try {
      const items = await shiftTemplatesApi.getEmployeePriorities(t.id)
      setPriorityItems(items)
    } catch {
      setPriorityItems([])
    } finally {
      setPriorityLoading(false)
    }
  }

  const movePriorityItem = (idx: number, dir: -1 | 1) => {
    const next = [...priorityItems]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setPriorityItems(next.map((x, i) => ({ ...x, priority_rank: i + 1 })))
  }

  const removePriorityItem = (employeeId: number) => {
    const next = priorityItems.filter((x) => x.employee !== employeeId)
    setPriorityItems(next.map((x, i) => ({ ...x, priority_rank: i + 1 })))
  }

  const addPriorityItem = () => {
    if (!addEmployeeId) return
    const emp = activeEmployees.find((e) => String(e.id) === addEmployeeId)
    if (!emp) return
    if (priorityItems.some((x) => x.employee === emp.id)) return
    const newItem: ShiftEmployeePriority = {
      id: 0,
      employee: emp.id,
      employee_name: emp.user_name || emp.user.username,
      priority_rank: priorityItems.length + 1,
      max_extra_shifts: null,
    }
    setPriorityItems([...priorityItems, newItem])
    setAddEmployeeId('')
  }

  const savePriorities = async () => {
    if (!priorityShift) return
    setPrioritySaving(true)
    try {
      await shiftTemplatesApi.putEmployeePriorities(
        priorityShift.id,
        priorityItems.map((x, i) => ({ employee: x.employee, priority_rank: i + 1, max_extra_shifts: x.max_extra_shifts })),
      )
      toast({ title: '已儲存', description: `${priorityShift.name} 員工優先順序已更新` })
      setPriorityShift(null)
    } catch {
      toast({ title: '儲存失敗', variant: 'destructive' })
    } finally {
      setPrioritySaving(false)
    }
  }

  useEffect(() => { setAddEmployeeId('') }, [priorityShift])

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }))

  const openCreate = () => {
    setEditing(null)
    setForm({ organization: '', name: '', start_time: '', end_time: '', break_minutes: '30', overlap_minutes: '0', min_staff_count: '1' })
    setShowDialog(true)
  }

  const openEdit = (t: ShiftTemplate) => {
    setEditing(t)
    setForm({
      organization: String(t.organization), name: t.name,
      start_time: t.start_time, end_time: t.end_time,
      break_minutes: String(t.break_minutes), overlap_minutes: String(t.overlap_minutes),
      min_staff_count: String(t.min_staff_count),
    })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      organization: Number(form.organization), name: form.name,
      start_time: form.start_time, end_time: form.end_time,
      break_minutes: Number(form.break_minutes), overlap_minutes: Number(form.overlap_minutes),
      min_staff_count: Number(form.min_staff_count),
    }
    if (editing) {
      await updateTemplate.mutateAsync({ id: editing.id, data: payload })
    } else {
      await createTemplate.mutateAsync(payload)
    }
    setShowDialog(false)
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">班別模板</h2>
          <p className="text-sm text-muted-foreground mt-0.5">定義可重複使用的班別，包含時段、人力門檻與證照要求</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增班別</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">尚未建立任何班別模板</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t, idx) => {
            const c = SHIFT_COLORS[idx % SHIFT_COLORS.length]
            return (
              <div key={t.id} className={cn('rounded-xl border p-5 transition-shadow hover:shadow-md', c.bg, c.border)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Clock className={cn('h-5 w-5 shrink-0', c.icon)} />
                    <div>
                      <div className={cn('font-semibold text-base', c.title)}>{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.organization_name}</div>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-medium text-muted-foreground">
                    {t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: '時長',     value: `${t.duration_hours} h` },
                    { label: '休息',     value: `${t.break_minutes} min` },
                    { label: '最少人力', value: `${t.min_staff_count} 人` },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                      <div className="font-semibold text-sm mt-0.5">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {t.required_certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {t.required_certifications.map((cert) => (
                      <Badge key={cert.id} variant="outline" className="text-xs bg-white/60">
                        <Award className="h-2.5 w-2.5 mr-1" />{cert.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-xs">
                    {t.is_active ? '啟用' : '停用'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/60" onClick={() => openPriorityDialog(t)} title="員工優先順序">
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/60" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/60 text-destructive hover:text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 員工優先順序 Dialog */}
      <Dialog open={!!priorityShift} onOpenChange={(open) => { if (!open) setPriorityShift(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>員工優先順序 — {priorityShift?.name}</DialogTitle>
            <DialogDescription>排在前面的員工在 AI 自動排班時優先指派此班別</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 min-h-[120px]">
            {priorityLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : priorityItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">尚無員工，請從下方新增</div>
            ) : (
              <div className="space-y-1.5">
                {priorityItems.map((item, idx) => (
                  <div key={item.employee} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0', AVATAR_COLORS[item.employee % AVATAR_COLORS.length])}>
                      {item.employee_name.slice(0, 1)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{item.employee_name}</span>
                    <Input
                      type="number"
                      className="w-20 h-7 text-xs"
                      placeholder="不限"
                      min={0}
                      max={99}
                      value={item.max_extra_shifts ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value)
                        setPriorityItems((prev) => prev.map((x, i) => i === idx ? { ...x, max_extra_shifts: val } : x))
                      }}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">上限</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => movePriorityItem(idx, -1)} disabled={idx === 0}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => movePriorityItem(idx, 1)} disabled={idx === priorityItems.length - 1}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removePriorityItem(item.employee)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1 border-t">
              <Select value={addEmployeeId} onValueChange={setAddEmployeeId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="新增員工…" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees
                    .filter((e) => !priorityItems.some((x) => x.employee === e.id))
                    .map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.user_name || e.user.username} · {e.employee_id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={addPriorityItem} disabled={!addEmployeeId}>
                <Plus className="h-3.5 w-3.5 mr-1" />加入
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityShift(null)}>取消</Button>
            <Button onClick={savePriorities} disabled={prioritySaving}>
              {prioritySaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 班別 Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '編輯班別' : '新增班別'}</DialogTitle>
            <DialogDescription>設定班別的時間、休息與人力配置</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>班別名稱</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="早班" required />
              </div>
              <div className="space-y-1.5">
                <Label>機構</Label>
                <Select value={form.organization} onValueChange={(v) => set('organization', v)}>
                  <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始時間</Label>
                <Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>結束時間</Label>
                <Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>休息(分鐘)</Label>
                <Input type="number" value={form.break_minutes} onChange={(e) => set('break_minutes', e.target.value)} min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>交接重疊(分鐘)</Label>
                <Input type="number" value={form.overlap_minutes} onChange={(e) => set('overlap_minutes', e.target.value)} min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>最少人力</Label>
                <Input type="number" value={form.min_staff_count} onChange={(e) => set('min_staff_count', e.target.value)} min={1} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editing ? '更新' : '建立'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
