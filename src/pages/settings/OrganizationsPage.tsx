import { useState } from 'react'
import { Plus, Building2, Store, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization,
  useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch,
} from '@/hooks/useOrganizations'
import type { Organization } from '@/types/organization'

export default function OrganizationsPage() {
  const { data: orgsData, isLoading } = useOrganizations()
  const { data: branchesData } = useBranches()
  const createOrg = useCreateOrganization()
  const updateOrg = useUpdateOrganization()
  const deleteOrg = useDeleteOrganization()
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()
  const deleteBranch = useDeleteBranch()

  const organizations = orgsData?.results ?? []
  const branches = branchesData?.results ?? []

  const [showOrgDialog, setShowOrgDialog] = useState(false)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [orgForm, setOrgForm] = useState({ name: '', code: '', address: '', phone: '', email: '' })
  const [branchForm, setBranchForm] = useState({ organization: '', name: '', code: '', address: '', phone: '' })
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null)

  const openCreateOrg = () => {
    setEditingOrg(null)
    setOrgForm({ name: '', code: '', address: '', phone: '', email: '' })
    setShowOrgDialog(true)
  }

  const openEditOrg = (org: Organization) => {
    setEditingOrg(org)
    setOrgForm({ name: org.name, code: org.code, address: org.address, phone: org.phone, email: org.email })
    setShowOrgDialog(true)
  }

  const handleSubmitOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingOrg) {
      await updateOrg.mutateAsync({ id: editingOrg.id, data: orgForm })
    } else {
      await createOrg.mutateAsync(orgForm)
    }
    setShowOrgDialog(false)
  }

  const openCreateBranch = (orgId?: number) => {
    setEditingBranchId(null)
    setBranchForm({ organization: orgId ? String(orgId) : '', name: '', code: '', address: '', phone: '' })
    setShowBranchDialog(true)
  }

  const openEditBranch = (b: { id: number; organization: number; name: string; code: string; address: string; phone: string }) => {
    setEditingBranchId(b.id)
    setBranchForm({ organization: String(b.organization), name: b.name, code: b.code, address: b.address, phone: b.phone })
    setShowBranchDialog(true)
  }

  const handleSubmitBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...branchForm, organization: Number(branchForm.organization) }
    if (editingBranchId) {
      await updateBranch.mutateAsync({ id: editingBranchId, data: payload })
    } else {
      await createBranch.mutateAsync(payload)
    }
    setShowBranchDialog(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">組織與分店管理</h1>
          <p className="text-muted-foreground mt-1">管理機構與分店資料</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreateBranch()}><Store className="h-4 w-4 mr-2" />新增分店</Button>
          <Button onClick={openCreateOrg}><Plus className="h-4 w-4 mr-2" />新增機構</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : organizations.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">尚未建立任何機構</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {organizations.map((org) => {
            const orgBranches = branches.filter((b) => b.organization === org.id)
            return (
              <Card key={org.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{org.name}</CardTitle>
                        <CardDescription className="font-mono">{org.code} · {org.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{org.branch_count} 間分店</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOrg(org)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteOrg.mutate(org.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {orgBranches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">尚無分店</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {orgBranches.map((b) => (
                        <div key={b.id} className="rounded-lg border p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{b.name}</p>
                              <p className="text-xs text-muted-foreground">{b.code}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBranch(b)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteBranch.mutate(b.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreateBranch(org.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />新增分店
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 機構 Dialog */}
      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? '編輯機構' : '新增機構'}</DialogTitle>
            <DialogDescription>填寫機構基本資料</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitOrg} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>機構名稱</Label><Input value={orgForm.name} onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>機構代碼</Label><Input value={orgForm.code} onChange={(e) => setOrgForm((p) => ({ ...p, code: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={orgForm.email} onChange={(e) => setOrgForm((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>電話</Label><Input value={orgForm.phone} onChange={(e) => setOrgForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>地址</Label><Input value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOrgDialog(false)}>取消</Button>
              <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>{editingOrg ? '更新' : '建立'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 分店 Dialog */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranchId ? '編輯分店' : '新增分店'}</DialogTitle>
            <DialogDescription>填寫分店資料</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBranch} className="space-y-4">
            <div className="space-y-1.5">
              <Label>所屬機構</Label>
              <Select value={branchForm.organization} onValueChange={(v) => setBranchForm((p) => ({ ...p, organization: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>分店名稱</Label><Input value={branchForm.name} onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>分店代碼</Label><Input value={branchForm.code} onChange={(e) => setBranchForm((p) => ({ ...p, code: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1.5"><Label>電話</Label><Input value={branchForm.phone} onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>地址</Label><Input value={branchForm.address} onChange={(e) => setBranchForm((p) => ({ ...p, address: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBranchDialog(false)}>取消</Button>
              <Button type="submit" disabled={createBranch.isPending || updateBranch.isPending}>{editingBranchId ? '更新' : '建立'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
