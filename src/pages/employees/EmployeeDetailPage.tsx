import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, FileText, Award, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  useEmployee, useUpdateEmployee, useAddContract, useAddCertification,
  useRemoveCertification, useCertifications,
} from '@/hooks/useEmployees'
import { useState } from 'react'
import type { ContractType } from '@/types/employee'

const contractTypeLabels: Record<string, string> = { full_time: '全職', part_time: '兼職', dispatch: '派遣' }

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employeeId = Number(id)
  const { data: employee, isLoading } = useEmployee(employeeId)
  const updateEmployee = useUpdateEmployee()
  const addContract = useAddContract()
  const addCert = useAddCertification()
  const removeCert = useRemoveCertification()
  const { data: allCertsData } = useCertifications()

  const [showContractDialog, setShowContractDialog] = useState(false)
  const [showCertDialog, setShowCertDialog] = useState(false)
  const [selectedCert, setSelectedCert] = useState('')
  const [contractForm, setContractForm] = useState({
    contract_type: 'full_time' as ContractType,
    start_date: '', end_date: '', base_salary: '', agreed_hours_per_week: '40', notes: '',
  })

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground">{employee.position} · {employee.branch_name}</p>
        </div>
        <Badge className={employee.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0' : ''} variant={employee.is_active ? 'default' : 'destructive'}>
          {employee.is_active ? '在職' : '離職'}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本資料卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />基本資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="員工編號" value={employee.employee_id} />
            <InfoRow label="Email" value={employee.user.email} />
            <InfoRow label="機構" value={employee.organization_name} />
            <InfoRow label="分店" value={employee.branch_name} />
            <InfoRow label="契約類型" value={contractTypeLabels[employee.contract_type] || employee.contract_type_display} />
            <InfoRow label="約定週工時" value={`${employee.agreed_hours_per_week} 小時`} />
            <InfoRow label="到職日" value={employee.hire_date} />
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateEmployee.mutate({ id: employeeId, data: { is_active: !employee.is_active } })}
              >
                {employee.is_active ? '設為離職' : '設為在職'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 證照卡片 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />持有證照</CardTitle>
              <CardDescription>管理員工的專業證照</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCertDialog(true)} disabled={availableCerts.length === 0}>
              <Plus className="h-4 w-4 mr-1" />新增
            </Button>
          </CardHeader>
          <CardContent>
            {employee.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">尚無證照紀錄</p>
            ) : (
              <div className="space-y-2">
                {employee.certifications.map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium text-sm">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">{cert.code}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeCert.mutate({ employeeId, certificationId: cert.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 契約記錄 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />契約記錄</CardTitle>
            <CardDescription>員工的勞動契約歷史</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowContractDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />新增契約
          </Button>
        </CardHeader>
        <CardContent>
          {employee.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">尚無契約紀錄</p>
          ) : (
            <div className="space-y-3">
              {employee.contracts.map((contract) => (
                <div key={contract.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{contractTypeLabels[contract.contract_type] || contract.contract_type_display}</Badge>
                    <span className="text-sm text-muted-foreground">{contract.start_date} ~ {contract.end_date || '至今'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <InfoRow label="基本薪資" value={`NT$ ${Number(contract.base_salary).toLocaleString()}`} />
                    <InfoRow label="約定週工時" value={`${contract.agreed_hours_per_week} 小時`} />
                  </div>
                  {contract.notes && <p className="text-xs text-muted-foreground mt-2">{contract.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增契約 Dialog */}
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

      {/* 新增證照 Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新增證照</DialogTitle>
            <DialogDescription>選擇要新增的證照</DialogDescription>
          </DialogHeader>
          <Select value={selectedCert} onValueChange={setSelectedCert}>
            <SelectTrigger><SelectValue placeholder="選擇證照" /></SelectTrigger>
            <SelectContent>
              {availableCerts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.code})</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertDialog(false)}>取消</Button>
            <Button onClick={handleAddCert} disabled={!selectedCert || addCert.isPending}>新增</Button>
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
