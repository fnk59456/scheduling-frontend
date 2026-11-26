import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const schedules = read('src/pages/schedules/SchedulesPage.tsx')
const compliancePanel = read('src/pages/schedules/ComplianceResultsPanel.tsx')
const complianceLib = read('src/lib/scheduleCompliance.ts')
const approval = read('src/pages/schedules/ApprovalScheduleSummaryPage.tsx')
const employeeForm = read('src/pages/employees/EmployeeFormDialog.tsx')

const checks = [
  ['簽核總表使用員工編號自然排序', approval.includes("localeCompare(b.employee_id, 'zh-TW', { numeric: true })")],
  ['民國年只轉換 1–150 年', employeeForm.includes('year < 1 || year > 150')],
  ['到職日提示預留固定高度', employeeForm.includes('min-h-9 text-xs')],
  ['拖曳模式預設為移動', schedules.includes("useState<'move' | 'copy'>('move')")],
  ['複製模式建立新班次', schedules.includes("if (dragMode === 'copy')") && schedules.includes('await schedulesApi.create')],
  ['移動模式更新原班次', schedules.includes('await schedulesApi.update(src.id')],
  ['複製模式不複製備註', schedules.includes("status: 'assigned'") && schedules.includes("notes: ''")],
  ['合規違規以陣列保留同格多筆', schedules.includes('map.set(key, [...(map.get(key) ?? []), v])')],
  ['班表提供違規與提醒篩選', schedules.includes('僅看違規') && schedules.includes('僅看提醒')],
  ['班次卡顯示問題數量', schedules.includes('>!{issues.length}</span>')],
  ['班次詳情提供合規診斷', schedules.includes('班次合規診斷')],
  ['合規面板提供分類、分布與班表導航', compliancePanel.includes('問題類型分布') && compliancePanel.includes('在班表上查看')],
  ['所有交辦的合規規則都有固定說明', [
    'max_daily_hours', 'max_daily_total_hours', 'min_rest_hours', 'max_weekly_hours',
    'max_consecutive_days', 'weekly_rest_days', 'holiday_scheduling',
    'holiday_work_refused', 'org_closed_day', 'female_night_shift',
    'max_monthly_overtime_hours', 'min_break_minutes',
  ].every((rule) => complianceLib.includes(`${rule}: {`))],
]

let failed = 0
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`)
  if (!passed) failed += 1
}

if (failed > 0) {
  console.error(`\n${failed} 項 smoke check 失敗`)
  process.exit(1)
}

console.log(`\n${checks.length} 項 smoke check 全部通過`)
