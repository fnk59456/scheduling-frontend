import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, UserCheck, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/common/DataTable'
import { useEmployees } from '@/hooks/useEmployees'
import { useBranches } from '@/hooks/useOrganizations'
import type { EmployeeListItem } from '@/types/employee'
import { EmployeeFormDialog } from './EmployeeFormDialog'

const contractTypeLabels: Record<string, string> = {
  full_time: '全職',
  part_time: '兼職',
  dispatch: '派遣',
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-gray-500',
]

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data: employeesData, isLoading } = useEmployees({
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    branch: branchFilter === 'all' ? undefined : Number(branchFilter),
  })
  const { data: branchesData } = useBranches()

  const employees = employeesData?.results ?? []
  const branches = branchesData?.results ?? []

  const columns: Column<EmployeeListItem>[] = [
    {
      key: 'employee_id',
      title: '員工編號',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.employee_id}</span>,
    },
    {
      key: 'user_name',
      title: '姓名',
      sortable: true,
      render: (row) => {
        const name = row.user_name || `${row.user.first_name} ${row.user.last_name}`.trim() || row.user.username
        const avatarColor = AVATAR_COLORS[row.id % AVATAR_COLORS.length]
        return (
          <div className="flex items-center gap-2.5">
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0', avatarColor)}>
              {name.slice(0, 1)}
            </div>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{row.user_email || row.user.email}</p>
            </div>
          </div>
        )
      },
    },
    { key: 'position', title: '職位', sortable: true },
    {
      key: 'contract_type',
      title: '契約類型',
      sortable: true,
      render: (row) => (
        <Badge variant="secondary">{contractTypeLabels[row.contract_type] || row.contract_type_display}</Badge>
      ),
    },
    { key: 'branch_name', title: '分店', sortable: true },
    {
      key: 'certification_count',
      title: '證照',
      render: (row) => (
        <Badge variant={row.certification_count > 0 ? 'default' : 'outline'}>
          {row.certification_count} 張
        </Badge>
      ),
    },
    { key: 'hire_date', title: '到職日', sortable: true },
    {
      key: 'is_active',
      title: '狀態',
      render: (row) => row.is_active ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
          <UserCheck className="h-3 w-3 mr-1" />在職
        </Badge>
      ) : (
        <Badge variant="destructive" className="border-0">
          <UserX className="h-3 w-3 mr-1" />離職
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
          <p className="text-muted-foreground mt-1">管理員工資料、契約與證照</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />新增員工
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">總員工數</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{employeesData?.count ?? '--'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">在職人數</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{employees.filter((e) => e.is_active).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">分店數</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{branches.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="篩選分店" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分店</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="篩選狀態" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="active">在職</SelectItem>
                <SelectItem value="inactive">離職</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={employees}
            loading={isLoading}
            searchPlaceholder="搜尋員工姓名、編號、Email..."
            searchKeys={['user_name', 'user_email', 'user.username', 'employee_id', 'position']}
            emptyMessage="沒有符合條件的員工"
            onRowClick={(row) => navigate(`/employees/${row.id}`)}
          />
        </CardContent>
      </Card>

      <EmployeeFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  )
}
