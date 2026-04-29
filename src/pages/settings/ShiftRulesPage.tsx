import { useState } from 'react'
import { Plus, Loader2, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useShiftRules, useCreateShiftRule, useUpdateShiftRule, useDeleteShiftRule } from '@/hooks/useShifts'
import { useOrganizations } from '@/hooks/useOrganizations'
import type { ShiftRule, ShiftRuleType } from '@/types/shift'

const ruleTypeLabels: Record<ShiftRuleType, string> = {
  max_consecutive_days: '最大連續工作天數',
  min_rest_hours: '最少休息時數',
  max_weekly_hours: '每週最大工時',
  mandatory_rest_day: '強制休息日',
}

const ruleTypeColors: Record<ShiftRuleType, string> = {
  max_consecutive_days: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  min_rest_hours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  max_weekly_hours: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  mandatory_rest_day: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

export default function ShiftRulesPage() {
  const { data, isLoading } = useShiftRules()
  const { data: orgsData } = useOrganizations()
  const createRule = useCreateShiftRule()
  const updateRule = useUpdateShiftRule()
  const deleteRule = useDeleteShiftRule()

  const rules = data?.results ?? []
  const organizations = orgsData?.results ?? []

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<ShiftRule | null>(null)
  const [form, setForm] = useState({ organization: '', name: '', rule_type: '' as ShiftRuleType | '', ruleValue: '' })

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }))

  const openCreate = () => {
    setEditing(null)
    setForm({ organization: '', name: '', rule_type: '', ruleValue: '' })
    setShowDialog(true)
  }

  const openEdit = (r: ShiftRule) => {
    setEditing(r)
    const val = typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)
    setForm({ organization: String(r.organization), name: r.name, rule_type: r.rule_type, ruleValue: val })
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let parsedValue: Record<string, unknown>
    try {
      parsedValue = JSON.parse(form.ruleValue)
    } catch {
      parsedValue = { value: Number(form.ruleValue) || form.ruleValue }
    }
    const payload = {
      organization: Number(form.organization),
      name: form.name,
      rule_type: form.rule_type as ShiftRuleType,
      value: parsedValue,
    }
    if (editing) {
      await updateRule.mutateAsync({ id: editing.id, data: payload })
    } else {
      await createRule.mutateAsync(payload)
    }
    setShowDialog(false)
  }

  const isPending = createRule.isPending || updateRule.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">排班規則</h1>
          <p className="text-muted-foreground mt-1">設定排班的工時上限、休息規則等約束條件</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增規則</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : rules.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">尚未建立任何排班規則</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((r) => (
            <Card key={r.id} className="card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />{r.name}
                  </CardTitle>
                  <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? '啟用' : '停用'}</Badge>
                </div>
                <CardDescription>{r.organization_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge className={`border-0 ${ruleTypeColors[r.rule_type] || ''}`}>
                  {ruleTypeLabels[r.rule_type] || r.rule_type_display}
                </Badge>
                <div className="text-sm bg-muted/50 rounded-md p-3 font-mono">
                  {JSON.stringify(r.value, null, 2)}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />編輯
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteRule.mutate(r.id)}>
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
            <DialogTitle>{editing ? '編輯規則' : '新增規則'}</DialogTitle>
            <DialogDescription>設定排班約束規則</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>規則名稱</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="每週最大工時 40 小時" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>機構</Label>
                <Select value={form.organization} onValueChange={(v) => set('organization', v)}>
                  <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>規則類型</Label>
                <Select value={form.rule_type} onValueChange={(v) => set('rule_type', v)}>
                  <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ruleTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>規則值（數字或 JSON）</Label>
              <Input value={form.ruleValue} onChange={(e) => set('ruleValue', e.target.value)} placeholder='40 或 {"value": 40, "unit": "hours"}' required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? '更新' : '建立'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
