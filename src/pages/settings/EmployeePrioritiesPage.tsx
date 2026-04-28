import { useEffect, useState } from 'react'
import { Plus, Clock, Loader2, ChevronUp, ChevronDown, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useShiftTemplates } from '@/hooks/useShifts'
import { useEmployees } from '@/hooks/useEmployees'
import { shiftTemplatesApi } from '@/api/endpoints/shifts'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ShiftTemplate, ShiftEmployeePriority } from '@/types/shift'

const SHIFT_COLORS = [
  { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'text-sky-500',    dot: 'bg-sky-500'    },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-500',  dot: 'bg-amber-500'  },
  { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-500', dot: 'bg-violet-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-500', dot: 'bg-indigo-500' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'text-rose-500',   dot: 'bg-rose-500'   },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',icon: 'text-emerald-500',dot: 'bg-emerald-500'},
]

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-teal-500', 'bg-indigo-500', 'bg-gray-500',
]

interface TemplatePriorityState {
  items: ShiftEmployeePriority[]
  loaded: boolean
}

export default function EmployeePrioritiesPage() {
  const { data: templatesData, isLoading: templatesLoading } = useShiftTemplates()
  const { data: employeesData } = useEmployees({ is_active: true })

  const templates = templatesData?.results ?? []
  const activeEmployees = employeesData?.results ?? []

  const [priorityMap, setPriorityMap] = useState<Record<number, TemplatePriorityState>>({})
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set())

  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)
  const [editItems, setEditItems] = useState<ShiftEmployeePriority[]>([])
  const [addEmployeeId, setAddEmployeeId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Load priorities for all templates on mount
  useEffect(() => {
    if (templates.length === 0) return
    templates.forEach((t) => {
      if (priorityMap[t.id]?.loaded) return
      setLoadingIds((prev) => new Set(prev).add(t.id))
      shiftTemplatesApi.getEmployeePriorities(t.id)
        .then((items) => setPriorityMap((prev) => ({ ...prev, [t.id]: { items, loaded: true } })))
        .catch(() => setPriorityMap((prev) => ({ ...prev, [t.id]: { items: [], loaded: true } })))
        .finally(() => setLoadingIds((prev) => { const s = new Set(prev); s.delete(t.id); return s }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.length])

  const openEdit = (t: ShiftTemplate) => {
    setEditingTemplate(t)
    setEditItems([...(priorityMap[t.id]?.items ?? [])])
    setAddEmployeeId('')
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...editItems]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setEditItems(next.map((x, i) => ({ ...x, priority_rank: i + 1 })))
  }

  const removeItem = (employeeId: number) => {
    const next = editItems.filter((x) => x.employee !== employeeId)
    setEditItems(next.map((x, i) => ({ ...x, priority_rank: i + 1 })))
  }

  const addItem = () => {
    if (!addEmployeeId) return
    const emp = activeEmployees.find((e) => String(e.id) === addEmployeeId)
    if (!emp || editItems.some((x) => x.employee === emp.id)) return
    setEditItems([...editItems, {
      id: 0, employee: emp.id,
      employee_name: emp.user_name || emp.user.username,
      priority_rank: editItems.length + 1,
      max_extra_shifts: null,
    }])
    setAddEmployeeId('')
  }

  const saveEdit = async () => {
    if (!editingTemplate) return
    setSaving(true)
    try {
      const saved = await shiftTemplatesApi.putEmployeePriorities(
        editingTemplate.id,
        editItems.map((x, i) => ({ employee: x.employee, priority_rank: i + 1, max_extra_shifts: x.max_extra_shifts })),
      )
      setPriorityMap((prev) => ({ ...prev, [editingTemplate.id]: { items: saved, loaded: true } }))
      toast({ title: '已儲存', description: `${editingTemplate.name} 優先順序已更新` })
      setEditingTemplate(null)
    } catch {
      toast({ title: '儲存失敗', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (templatesLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">員工優先順序</h2>
        <p className="text-sm text-muted-foreground mt-0.5">設定各班別在 AI 自動排班時的員工優先指派順序</p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border py-16 text-center text-muted-foreground">
          請先在「班別模板」頁面建立班別
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t, idx) => {
            const c = SHIFT_COLORS[idx % SHIFT_COLORS.length]
            const state = priorityMap[t.id]
            const isLoading = loadingIds.has(t.id)
            const items = state?.items ?? []

            return (
              <div key={t.id} className={cn('rounded-xl border p-5', c.bg, c.border)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <Clock className={cn('h-4 w-4', c.icon)} />
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {t.start_time.slice(0, 5)} – {t.end_time.slice(0, 5)}
                    </span>
                    <Badge variant="outline" className="bg-white/60 text-xs">
                      <Users className="h-2.5 w-2.5 mr-1" />{items.length} 位員工
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="bg-white/60 hover:bg-white/80" onClick={() => openEdit(t)}>
                    編輯優先順序
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />載入中…
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-1">尚未設定優先順序，AI 排班將隨機指派</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, rank) => (
                      <div key={item.employee} className="flex items-center gap-1.5 rounded-lg bg-white/70 border border-white/80 px-2.5 py-1.5">
                        <span className="text-xs text-muted-foreground">#{rank + 1}</span>
                        <div className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0', AVATAR_COLORS[item.employee % AVATAR_COLORS.length])}>
                          {item.employee_name.slice(0, 1)}
                        </div>
                        <span className="text-xs font-medium">{item.employee_name}</span>
                        {item.max_extra_shifts !== null && (
                          <span className="text-[10px] text-muted-foreground">上限 {item.max_extra_shifts}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>員工優先順序 — {editingTemplate?.name}</DialogTitle>
            <DialogDescription>排在前面的員工在 AI 自動排班時優先指派此班別</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 min-h-[120px]">
            {editItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">尚無員工，請從下方新增</div>
            ) : (
              <div className="space-y-1.5">
                {editItems.map((item, idx) => (
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
                      min={0} max={99}
                      value={item.max_extra_shifts ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value)
                        setEditItems((prev) => prev.map((x, i) => i === idx ? { ...x, max_extra_shifts: val } : x))
                      }}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">上限</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(idx, 1)} disabled={idx === editItems.length - 1}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(item.employee)}>
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
                    .filter((e) => !editItems.some((x) => x.employee === e.id))
                    .map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.user_name || e.user.username} · {e.employee_id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={addItem} disabled={!addEmployeeId}>
                <Plus className="h-3.5 w-3.5 mr-1" />加入
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>取消</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
