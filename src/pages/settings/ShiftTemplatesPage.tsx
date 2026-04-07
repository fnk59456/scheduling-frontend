import { useState } from 'react'
import { Plus, Clock, Users, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useShiftTemplates, useCreateShiftTemplate, useUpdateShiftTemplate, useDeleteShiftTemplate } from '@/hooks/useShifts'
import { useOrganizations } from '@/hooks/useOrganizations'
import type { ShiftTemplate } from '@/types/shift'

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
          <h1 className="text-3xl font-bold tracking-tight">班別設定</h1>
          <p className="text-muted-foreground mt-1">管理各種班別的時間與人力配置</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增班別</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">尚未建立任何班別模板</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  <Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? '啟用' : '停用'}</Badge>
                </div>
                <CardDescription>{t.organization_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}</span>
                  <Badge variant="outline" className="ml-auto">{t.duration_hours} 小時</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>最少 {t.min_staff_count} 人</span>
                  <span className="text-muted-foreground ml-auto">休息 {t.break_minutes} 分鐘</span>
                </div>
                {t.required_certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.required_certifications.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />編輯
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
