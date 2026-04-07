import { useState } from 'react'
import { Plus, Loader2, Trash2, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { useCertifications, useCreateCertification } from '@/hooks/useEmployees'
import { certificationsApi } from '@/api/endpoints/employees'
import type { Certification } from '@/types/employee'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

export default function CertificationsPage() {
  const { data, isLoading } = useCertifications()
  const createCert = useCreateCertification()
  const qc = useQueryClient()

  const certifications = data?.results ?? []

  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createCert.mutateAsync(form)
    setShowDialog(false)
    setForm({ name: '', code: '', description: '' })
  }

  const handleDelete = async (id: number) => {
    try {
      await certificationsApi.delete(id)
      qc.invalidateQueries({ queryKey: ['certifications'] })
      toast({ title: '刪除成功', description: '證照類型已刪除' })
    } catch {
      toast({ title: '刪除失敗', description: '無法刪除證照類型', variant: 'destructive' })
    }
  }

  const columns: Column<Certification>[] = [
    {
      key: 'name', title: '證照名稱', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: 'code', title: '代碼', sortable: true, render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'description', title: '說明' },
    {
      key: 'is_required', title: '必備',
      render: (row) => <Badge variant={row.is_required ? 'default' : 'outline'}>{row.is_required ? '必備' : '選修'}</Badge>,
    },
    {
      key: 'actions', title: '',
      render: (row) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={certifications}
            loading={isLoading}
            searchPlaceholder="搜尋證照名稱或代碼..."
            searchKeys={['name', 'code']}
            emptyMessage="尚未建立任何證照類型"
            actions={
              <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />新增證照類型</Button>
            }
          />
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增證照類型</DialogTitle>
            <DialogDescription>建立新的證照分類</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>證照名稱</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="護理師執照" required /></div>
              <div className="space-y-1.5"><Label>代碼</Label><Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="NURSE" required /></div>
            </div>
            <div className="space-y-1.5"><Label>說明</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="選填" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={createCert.isPending}>{createCert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}建立</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
