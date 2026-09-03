import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, FileText, Award, Loader2, User,
  CalendarCheck, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  useAddContract, useAddCertification, useAddEmployeeTimeSlot, useCertifications,
  useEmployee, useEmployeeAvailability, useRemoveCertification,
  useRemoveEmployeeTimeSlot, useUpdateEmployeeAvailability,
} from '@/hooks/useEmployees'
import { EmployeeFormDialog } from './EmployeeFormDialog'
import { cn } from '@/lib/utils'
import type { Certification, ContractType, SlotType } from '@/types/employee'

const contractTypeLabels: Record<string, string> = { full_time: '全職', part_time: '兼職', dispatch: '派遣' }

const DAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
const EVERY_DAY_VALUE = '__every_day__'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employeeId = Number(id)
  const { data: employee, isLoading } = useEmployee(employeeId)
  const addContract = useAddContract()
  const addCert = useAddCertification()
  const removeCert = useRemoveCertification()
  const { data: allCertsData } = useCertifications()
  const availabilityQuery = useEmployeeAvailability(employeeId)
  const updateAvailability = useUpdateEmployeeAvailability()
  const addTimeSlot = useAddEmployeeTimeSlot()
  const removeTimeSlot = useRemoveEmployeeTimeSlot()

  const [showContractDialog, setShowContractDialog] = useState(false)
  const [showCertDialog, setShowCertDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedCert, setSelectedCert] = useState('')
  const [certToRemove, setCertToRemove] = useState<Certification | null>(null)
  const [contractForm, setContractForm] = useState({
    contract_type: 'full_time' as ContractType,
    start_date: '', end_date: '', base_salary: '', agreed_hours_per_week: '40', notes: '',
  })

  const [showAddSlot, setShowAddSlot] = useState(false)
  const [slotForm, setSlotForm] = useState({ slot_type: 'blocked' as SlotType, day: EVERY_DAY_VALUE, start: '', end: '', label: '' })
  const [availHours, setAvailHours] = useState('')
  const [availRules, setAvailRules] = useState('')

  useEffect(() => {
    if (availabilityQuery.isLoading || !employee) return
    setAvailHours(availabilityQuery.data?.required_hours_per_week ?? employee.agreed_hours_per_week ?? '')
    setAvailRules(availabilityQuery.data?.special_rules ?? '')
  }, [availabilityQuery.data, availabilityQuery.isLoading, employee])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">找不到此員工</h2>
        <Button variant="link" onClick={() => navigate('/employees')}>返回員工列表</Button>
      </div>
    )
  }

  const allCerts = allCertsData?.results ?? []
  const employeeCertIds = employee.certifications.map((c) => c.id)
  const availableCerts = allCerts.filter((c) => !employeeCertIds.includes(c.id))
  const displayName = `${employee.user.last_name}${employee.user.first_name}`.trim() || employee.user.username
  const slots = availabilityQuery.data?.time_slots ?? []

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault()
    await addContract.mutateAsync({
      employeeId,
      data: {
        employee: employeeId,
        contract_type: contractForm.contract_type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || undefined,
        base_salary: Number(contractForm.base_salary),
        agreed_hours_per_week: Number(contractForm.agreed_hours_per_week),
        notes: contractForm.notes,
      },
    })
    setShowContractDialog(false)
    setContractForm({ contract_type: 'full_time', start_date: '', end_date: '', base_salary: '', agreed_hours_per_week: '40', notes: '' })
  }

  const handleAddCert = async () => {
    if (!selectedCert) return
    await addCert.mutateAsync({ employeeId, certificationId: Number(selectedCert) })
    setShowCertDialog(false)
    setSelectedCert('')
  }

  const handleSaveAvailability = async () => {
    await updateAvailability.mutateAsync({
      employeeId,
      data: {
        required_hours_per_week: availHours.trim() ? Number(availHours) : null,
        special_rules: availRules,
        effective_from: null,
        effective_to: null,
      },
    })
  }

  const handleAddSlot = async () => {
    await addTimeSlot.mutateAsync({
      employeeId,
      data: {
        slot_type: slotForm.slot_type,
        day_of_week: slotForm.day === EVERY_DAY_VALUE ? null : Number(slotForm.day) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        start_time: slotForm.start,
        end_time: slotForm.end,
        label: slotForm.label,
      },
    })
    setShowAddSlot(false)
    setSlotForm({ slot_type: 'blocked', day: EVERY_DAY_VALUE, start: '', end: '', label: '' })
  }

  const handleRemoveCert = async () => {
    if (!certToRemove) return
    await removeCert.mutateAsync({ employeeId, certificationId: certToRemove.id })
    setCertToRemove(null)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/employees')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />返回員工列表
      </Button>

      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
          {displayName.slice(0, 1)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{employee.employee_id}</span>
            <span>·</span><span>{employee.position}</span>
            <span>·</span><span>{employee.branch_name}</span>
            <Badge variant="secondary">{contractTypeLabels[employee.contract_type] || employee.contract_type_display}</Badge>
            <Badge className={employee.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30'
              : 'bg-destructive/10 text-destructive border-destructive/20'
            } variant="outline">
              {employee.is_active ? '在職' : '離職'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>編輯</Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic"><User className="h-3.5 w-3.5 mr-1.5" />基本資料</TabsTrigger>
          <TabsTrigger value="cert"><Award className="h-3.5 w-3.5 mr-1.5" />證照</TabsTrigger>
          <TabsTrigger value="avail"><CalendarCheck className="h-3.5 w-3.5 mr-1.5" />可用性與偏好</TabsTrigger>
          <TabsTrigger value="contract"><FileText className="h-3.5 w-3.5 mr-1.5" />契約記錄</TabsTrigger>
        </TabsList>

        {/* ---- 基本資料 ---- */}
        <TabsContent value="basic" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">基本資訊</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['員工編號', employee.employee_id],
                  ['Email', employee.user.email],
                  ['機構', employee.organization_name],
                  ['分店', employee.branch_name],
                  ['職位', employee.position],
                  ['到職日', employee.hire_date],
                ].map(([k, v]) => <InfoRow key={k} label={k} value={v} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">契約資訊</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">契約類型</span>
                  <Badge variant="secondary">{contractTypeLabels[employee.contract_type] || employee.contract_type_display}</Badge>
                </div>
                <InfoRow label="週固定工時" value={`${employee.agreed_hours_per_week} 小時`} />
                <InfoRow label="到職日" value={employee.hire_date} />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">狀態</span>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">有效中</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- 證照 ---- */}
        <TabsContent value="cert" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">持有證照（{employee.certifications.length}）</CardTitle>
                <CardDescription>管理員工的專業證照</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCertDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />指派證照
              </Button>
            </CardHeader>
            <CardContent>
              {employee.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">尚無證照紀錄</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {employee.certifications.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                          <Award className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{cert.name}</p>
                          <p className="text-xs text-muted-foreground">{cert.code}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setCertToRemove(cert)}
                        aria-label={`移除${cert.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- 可用性與偏好 ---- */}
        <TabsContent value="avail" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>可用性與偏好時段</CardTitle>
                <CardDescription>不可排時段將被排班引擎排除；偏好時段 AI 會優先安排</CardDescription>
              </div>
              <Button size="sm" onClick={handleSaveAvailability} disabled={availabilityQuery.isLoading || updateAvailability.isPending}>
                {updateAvailability.isPending
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <Check className="h-3.5 w-3.5 mr-1" />}
                儲存設定
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>每週要求工時</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={availHours}
                      onChange={(e) => setAvailHours(e.target.value)}
                      className="max-w-[140px]"
                    />
                    <span className="text-sm text-muted-foreground">小時 / 週</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>備註 / 特殊規則</Label>
                  <Input value={availRules} onChange={(e) => setAvailRules(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="font-medium text-sm">時段設定（{slots.length}）</div>
                <Button size="sm" variant="outline" onClick={() => setShowAddSlot(true)} disabled={availabilityQuery.isLoading}>
                  <Plus className="h-3.5 w-3.5 mr-1" />新增時段
                </Button>
              </div>

              <div className="space-y-2">
                {availabilityQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />載入可用性設定
                  </div>
                )}
                {availabilityQuery.isError && (
                  <div className="py-8 text-center text-sm text-destructive">無法載入可用性設定，請稍後重試。</div>
                )}
                {slots.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3',
                      s.slot_type === 'blocked'
                        ? 'bg-rose-50/40 border-rose-200/60 dark:bg-rose-950/20'
                        : 'bg-emerald-50/40 border-emerald-200/60 dark:bg-emerald-950/20'
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={s.slot_type === 'blocked'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }
                    >
                      {s.slot_type === 'blocked' ? '不可排' : '偏好'}
                    </Badge>
                    <span className="font-medium text-sm w-14">
                      {s.day_of_week === null ? '每天' : DAY_LABELS[s.day_of_week]}
                    </span>
                    <span className="font-mono text-sm">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                    <span className="text-sm text-muted-foreground flex-1 truncate">
                      備註：{s.label || '無'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimeSlot.mutate({ employeeId, slotId: s.id })}
                      disabled={removeTimeSlot.isPending}
                      aria-label="刪除時段"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {!availabilityQuery.isLoading && !availabilityQuery.isError && slots.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">尚未設定任何時段</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- 契約記錄 ---- */}
        <TabsContent value="contract" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">契約記錄</CardTitle>
                <CardDescription>員工的勞動契約歷史</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowContractDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />新增契約
              </Button>
            </CardHeader>
            <CardContent>
              {employee.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">尚無契約紀錄</p>
              ) : (
                <div className="space-y-3">
                  {employee.contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className={cn(
                        'rounded-lg border p-4 flex items-center gap-4',
                        !contract.end_date && 'border-primary/40 bg-primary/5'
                      )}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contractTypeLabels[contract.contract_type] || contract.contract_type_display}契約</span>
                          {!contract.end_date && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">有效中</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {contract.start_date} ~ {contract.end_date || '至今'} · {contract.agreed_hours_per_week} 小時/週 · NT$ {Number(contract.base_salary).toLocaleString()}
                        </div>
                        {contract.notes && <p className="text-xs text-muted-foreground mt-1">{contract.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        employee={employee}
        onDeleted={() => navigate('/employees')}
      />

      {/* Add Slot Dialog */}
      <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增時段</DialogTitle>
            <DialogDescription>設定不可排 / 偏好時段</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>類型</Label>
              <Select value={slotForm.slot_type} onValueChange={(v) => setSlotForm((p) => ({ ...p, slot_type: v as SlotType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocked">不可排</SelectItem>
                  <SelectItem value="preferred">偏好</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>星期</Label>
              <Select value={slotForm.day} onValueChange={(v) => setSlotForm((p) => ({ ...p, day: v }))}>
                <SelectTrigger><SelectValue placeholder="每天" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERY_DAY_VALUE}>每天</SelectItem>
                  {DAY_LABELS.map((l, i) => <SelectItem key={i} value={String(i)}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>開始時間</Label>
              <Input type="time" value={slotForm.start} onChange={(e) => setSlotForm((p) => ({ ...p, start: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>結束時間</Label>
              <Input type="time" value={slotForm.end} onChange={(e) => setSlotForm((p) => ({ ...p, end: e.target.value }))} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>備註（選填）</Label>
              <Input
                value={slotForm.label}
                onChange={(e) => setSlotForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="例：接小孩、進修"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSlot(false)}>取消</Button>
            <Button onClick={handleAddSlot} disabled={!slotForm.start || !slotForm.end || addTimeSlot.isPending}>
              {addTimeSlot.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contract Dialog */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增契約</DialogTitle>
            <DialogDescription>為 {displayName} 新增一份勞動契約</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddContract} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>契約類型</Label>
                <Select value={contractForm.contract_type} onValueChange={(v) => setContractForm((p) => ({ ...p, contract_type: v as ContractType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">全職</SelectItem>
                    <SelectItem value="part_time">兼職</SelectItem>
                    <SelectItem value="dispatch">派遣</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>基本薪資</Label>
                <Input type="number" value={contractForm.base_salary} onChange={(e) => setContractForm((p) => ({ ...p, base_salary: e.target.value }))} placeholder="28000" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始日期</Label>
                <Input type="date" value={contractForm.start_date} onChange={(e) => setContractForm((p) => ({ ...p, start_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>結束日期</Label>
                <Input type="date" value={contractForm.end_date} onChange={(e) => setContractForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>約定週工時</Label>
              <Input type="number" value={contractForm.agreed_hours_per_week} onChange={(e) => setContractForm((p) => ({ ...p, agreed_hours_per_week: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={contractForm.notes} onChange={(e) => setContractForm((p) => ({ ...p, notes: e.target.value }))} placeholder="選填" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowContractDialog(false)}>取消</Button>
              <Button type="submit" disabled={addContract.isPending}>
                {addContract.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}新增
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Cert Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>指派證照</DialogTitle>
            <DialogDescription>從主管已建立的證照類型中選擇並指派給員工。</DialogDescription>
          </DialogHeader>
          {availableCerts.length > 0 ? (
            <Select value={selectedCert} onValueChange={setSelectedCert}>
              <SelectTrigger><SelectValue placeholder="選擇證照" /></SelectTrigger>
              <SelectContent>
                {availableCerts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.code})</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              沒有其他可指派的證照。若需要新的證照類型，請先前往系統設定建立。
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertDialog(false)}>取消</Button>
            <Button
              variant={availableCerts.length === 0 ? 'default' : 'outline'}
              onClick={() => {
                setShowCertDialog(false)
                navigate('/settings/certifications')
              }}
            >
              建立新證照類型
            </Button>
            {availableCerts.length > 0 && (
              <Button onClick={handleAddCert} disabled={!selectedCert || addCert.isPending}>指派</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!certToRemove} onOpenChange={(open) => !open && setCertToRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>移除員工證照</DialogTitle>
            <DialogDescription>
              確定要從 {displayName} 移除「{certToRemove?.name}」嗎？這可能影響後續排班資格判定。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertToRemove(null)} disabled={removeCert.isPending}>取消</Button>
            <Button variant="destructive" onClick={handleRemoveCert} disabled={removeCert.isPending}>
              {removeCert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
