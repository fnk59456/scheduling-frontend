import { useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'
import { useBranches } from '@/hooks/useOrganizations'
import { useShiftTemplates, useStaffingRequirements, useCreateStaffingRequirement, useUpdateStaffingRequirement, useDeleteStaffingRequirement } from '@/hooks/useShifts'
import type { StaffingRequirement } from '@/types/shift'

const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
type Scope = 'daily' | 'weekday' | 'date'

export default function StaffingRequirementsPage() {
  const organization = useAuthStore((state) => state.user?.organization)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffingRequirement | null>(null)
  const [scope, setScope] = useState<Scope>('daily')
  const [weekday, setWeekday] = useState('0')
  const [date, setDate] = useState('')
  const [branch, setBranch] = useState('all')
  const [shift, setShift] = useState('all')
  const [minStaff, setMinStaff] = useState('1')
  const [maxStaff, setMaxStaff] = useState('')
  const [note, setNote] = useState('')

  const { data, isLoading } = useStaffingRequirements()
  const { data: branchData } = useBranches(organization ? { organization } : undefined)
  const { data: shiftData } = useShiftTemplates(organization ? { organization, is_active: true } : { is_active: true })
  const createRequirement = useCreateStaffingRequirement()
  const updateRequirement = useUpdateStaffingRequirement()
  const deleteRequirement = useDeleteStaffingRequirement()
  const busy = createRequirement.isPending || updateRequirement.isPending || deleteRequirement.isPending

  const reset = () => {
    setEditing(null); setScope('daily'); setWeekday('0'); setDate(''); setBranch('all'); setShift('all'); setMinStaff('1'); setMaxStaff(''); setNote('')
  }
  const startCreate = () => { reset(); setOpen(true) }
  const startEdit = (item: StaffingRequirement) => {
    setEditing(item)
    setScope(item.date ? 'date' : item.weekday !== null ? 'weekday' : 'daily')
    setWeekday(String(item.weekday ?? 0)); setDate(item.date || ''); setBranch(item.branch ? String(item.branch) : 'all'); setShift(item.shift_template ? String(item.shift_template) : 'all'); setMinStaff(String(item.min_staff)); setMaxStaff(item.max_staff === null ? '' : String(item.max_staff)); setNote(item.note || '')
    setOpen(true)
  }
  const submit = async () => {
    const payload = {
      organization: organization || undefined,
      branch: branch === 'all' ? null : Number(branch),
      shift_template: shift === 'all' ? null : Number(shift),
      weekday: scope === 'weekday' ? Number(weekday) : null,
      date: scope === 'date' ? date : null,
      min_staff: Number(minStaff),
      max_staff: maxStaff === '' ? null : Number(maxStaff),
      note,
      is_active: true,
    }
    if (editing) await updateRequirement.mutateAsync({ id: editing.id, data: payload })
    else await createRequirement.mutateAsync(payload)
    setOpen(false); reset()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />最低人力需求</CardTitle><CardDescription className="mt-2">設定每日、每週固定日或特定日期的人力下限；「全日總人數」與「特定班別」可分開設定。</CardDescription></div>
        <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />新增需求</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin" /></div> : !data?.results.length ? <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">尚未設定人力需求</div> : (
          <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/40"><tr>{['適用時機', '分店', '班別', '人力範圍', '備註', '操作'].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{label}</th>)}</tr></thead><tbody>{data.results.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="px-4 py-3 font-medium">{item.date || item.weekday_label || '每天'}</td>
              <td className="px-4 py-3">{item.branch_name || '全機構'}</td>
              <td className="px-4 py-3"><Badge variant="outline">{item.shift_template_name || '全日總人數'}</Badge></td>
              <td className="px-4 py-3">最少 {item.min_staff} 人{item.max_staff === null ? '' : ` · 最多 ${item.max_staff} 人`}</td>
              <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">{item.note || '—'}</td>
              <td className="px-4 py-3"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => startEdit(item)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('確定刪除這項人力需求？')) deleteRequirement.mutate(item.id) }}><Trash2 className="h-4 w-4" /></Button></div></td>
            </tr>
          ))}</tbody></table></div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '編輯' : '新增'}人力需求</DialogTitle><DialogDescription>較具體的特定日期規則會在對應日期使用。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>適用日期</Label><Select value={scope} onValueChange={(value) => setScope(value as Scope)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">每天</SelectItem><SelectItem value="weekday">每週固定日</SelectItem><SelectItem value="date">特定日期</SelectItem></SelectContent></Select></div>
            {scope === 'weekday' ? <div className="space-y-1.5"><Label>星期</Label><Select value={weekday} onValueChange={setWeekday}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{weekdays.map((label, index) => <SelectItem key={label} value={String(index)}>{label}</SelectItem>)}</SelectContent></Select></div> : null}
            {scope === 'date' ? <div className="space-y-1.5"><Label>日期</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label>分店</Label><Select value={branch} onValueChange={setBranch}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全機構</SelectItem>{branchData?.results.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>班別</Label><Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全日總人數</SelectItem>{shiftData?.results.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>最少人數</Label><Input type="number" min={0} value={minStaff} onChange={(e) => setMinStaff(e.target.value)} /></div><div className="space-y-1.5"><Label>最多人數（選填）</Label><Input type="number" min={0} value={maxStaff} onChange={(e) => setMaxStaff(e.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>備註</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={busy || !minStaff || (scope === 'date' && !date) || (maxStaff !== '' && Number(maxStaff) < Number(minStaff))} onClick={submit}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}儲存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
