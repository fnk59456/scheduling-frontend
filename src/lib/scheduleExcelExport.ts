import type { Worksheet } from 'exceljs'
import type { EmployeeListItem } from '@/types/employee'
import type { Schedule } from '@/types/schedule'

export type ScheduleExportLayout = 'personal' | 'integrated'

type CreateScheduleWorkbookParams = {
  schedules: Schedule[]
  employees?: EmployeeListItem[]
  dateFrom: string
  dateTo: string
  versionLabel: string
  layout: ScheduleExportLayout
}

type EmployeeScheduleGroup = {
  id: number
  employeeId: string
  name: string
  position: string
  schedules: Schedule[]
}

type MonthSection = {
  year: number
  month: number
  weeks: Date[][]
}

const weekdayLabels = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const weekdayShortLabels = ['日', '一', '二', '三', '四', '五', '六']
const shiftFills = ['FFEAF3FF', 'FFFFF4DC', 'FFF2ECFF', 'FFE8F7F2', 'FFFFEAF0', 'FFEAF0FF']

const thinBorder = { style: 'thin' as const, color: { argb: 'FFD6DEE8' } }
const calendarBorder = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = result.getDay()
  result.setDate(result.getDate() - weekday)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date)
  result.setDate(result.getDate() + 6)
  return result
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function buildMonthSections(dateFrom: string, dateTo: string): MonthSection[] {
  const sections: MonthSection[] = []
  const lastMonth = new Date(parseDate(dateTo).getFullYear(), parseDate(dateTo).getMonth(), 1)

  for (
    let month = new Date(parseDate(dateFrom).getFullYear(), parseDate(dateFrom).getMonth(), 1);
    month <= lastMonth;
    month = addMonths(month, 1)
  ) {
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const firstVisible = startOfWeek(month)
    const lastVisible = endOfWeek(monthEnd)
    const weeks: Date[][] = []

    for (let weekStart = firstVisible; weekStart <= lastVisible; weekStart = addDays(weekStart, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)))
    }

    sections.push({
      year: month.getFullYear(),
      month: month.getMonth(),
      weeks,
    })
  }

  return sections
}

function employeeName(employee: EmployeeListItem) {
  const fullName = `${employee.user.first_name} ${employee.user.last_name}`.trim()
  return employee.user_name || fullName || employee.user.username || employee.employee_id
}

function groupSchedulesByEmployee(schedules: Schedule[], employees: EmployeeListItem[] = []) {
  const groups = new Map<number, EmployeeScheduleGroup>()

  for (const employee of employees) {
    groups.set(employee.id, {
      id: employee.id,
      employeeId: employee.employee_id,
      name: employeeName(employee),
      position: employee.position,
      schedules: [],
    })
  }

  for (const schedule of schedules) {
    const existing = groups.get(schedule.employee.id)
    if (existing) {
      existing.schedules.push(schedule)
      continue
    }

    groups.set(schedule.employee.id, {
      id: schedule.employee.id,
      employeeId: schedule.employee.employee_id,
      name: schedule.employee.user_name || schedule.employee.employee_id,
      position: schedule.employee.position,
      schedules: [schedule],
    })
  }

  return Array.from(groups.values()).sort((a, b) => (
    a.employeeId.localeCompare(b.employeeId, 'zh-TW', { numeric: true })
  ))
}

function configureWorksheet(sheet: Worksheet, versionLabel: string, dateFrom: string, dateTo: string) {
  sheet.properties.defaultRowHeight = 18
  sheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }]
  sheet.columns = Array.from({ length: 7 }, () => ({ width: 18 }))
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.25,
    },
  }
  sheet.headerFooter.oddFooter = `&L${versionLabel}&C${dateFrom} ~ ${dateTo}&R第 &P / &N 頁`
}

function renderWorkbookHeader(
  sheet: Worksheet,
  versionLabel: string,
  dateFrom: string,
  dateTo: string,
) {
  sheet.mergeCells('A1:G1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = versionLabel
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF17365D' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 26

  sheet.mergeCells('A2:G2')
  const periodCell = sheet.getCell('A2')
  periodCell.value = `${dateFrom} ～ ${dateTo}`
  periodCell.font = { size: 10, color: { argb: 'FF5B6573' } }
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(2).height = 20
}

function renderEmployeeBlock(
  sheet: Worksheet,
  startRow: number,
  group: EmployeeScheduleGroup,
  months: MonthSection[],
  dateFrom: string,
  dateTo: string,
  shiftColorById: Map<number, number>,
) {
  const scheduleByDate = new Map<string, Schedule[]>()
  for (const schedule of group.schedules) {
    const schedulesForDate = scheduleByDate.get(schedule.schedule_date) ?? []
    schedulesForDate.push(schedule)
    scheduleByDate.set(schedule.schedule_date, schedulesForDate)
  }

  const scheduledDays = scheduleByDate.size
  const totalHours = group.schedules.reduce((total, schedule) => {
    const hours = Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0)
    return total + (Number.isFinite(hours) ? hours : 0)
  }, 0)

  let rowNumber = startRow
  sheet.mergeCells(rowNumber, 1, rowNumber, 7)
  const employeeCell = sheet.getCell(rowNumber, 1)
  employeeCell.value = [
    group.employeeId,
    group.name,
    group.position,
    `排班 ${scheduledDays} 天`,
    `預計 ${Math.round(totalHours * 10) / 10} 小時`,
  ].filter(Boolean).join('　｜　')
  employeeCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  employeeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }
  employeeCell.alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getRow(rowNumber).height = 25
  rowNumber += 1

  for (const [monthIndex, section] of months.entries()) {
    if (monthIndex > 0) {
      sheet.getRow(rowNumber).height = 8
      rowNumber += 1
    }

    sheet.mergeCells(rowNumber, 1, rowNumber, 7)
    const monthCell = sheet.getCell(rowNumber, 1)
    monthCell.value = `${section.year} 年 ${section.month + 1} 月`
    monthCell.font = { bold: true, size: 11, color: { argb: 'FF17365D' } }
    monthCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } }
    monthCell.alignment = { horizontal: 'center', vertical: 'middle' }
    monthCell.border = calendarBorder
    sheet.getRow(rowNumber).height = 23
    rowNumber += 1

    const weekdayRow = sheet.getRow(rowNumber)
    weekdayLabels.forEach((label, index) => {
      const cell = weekdayRow.getCell(index + 1)
      cell.value = label
      cell.font = {
        bold: true,
        size: 10,
        color: { argb: index === 0 || index === 6 ? 'FF9C3D10' : 'FF334155' },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === 0 || index === 6 ? 'FFFFE8D6' : 'FFEFF3F8' },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = calendarBorder
    })
    weekdayRow.height = 21
    rowNumber += 1

    for (const week of section.weeks) {
      const row = sheet.getRow(rowNumber)
      let maxLines = 2

      week.forEach((date, index) => {
        const cell = row.getCell(index + 1)
        const dateKey = formatDate(date)
        const belongsToMonth = date.getMonth() === section.month
        const isWithinRange = dateKey >= dateFrom && dateKey <= dateTo
        const schedulesForDate = belongsToMonth && isWithinRange
          ? (scheduleByDate.get(dateKey) ?? [])
          : []

        cell.border = calendarBorder
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

        if (!belongsToMonth || !isWithinRange) {
          cell.value = ''
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } }
          return
        }

        const dateLabel = `${date.getMonth() + 1}/${date.getDate()}（${weekdayShortLabels[index]}）`
        if (schedulesForDate.length === 0) {
          cell.value = `${dateLabel}\n未排班`
          cell.font = { size: 9, color: { argb: 'FF7A8491' } }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: index === 0 || index === 6 ? 'FFFFF7ED' : 'FFFFFFFF' },
          }
          return
        }

        const shiftLines = schedulesForDate.map((schedule) => (
          `${schedule.shift_template.name} ${schedule.shift_template.start_time.slice(0, 5)}-${schedule.shift_template.end_time.slice(0, 5)}`
        ))
        cell.value = `${dateLabel}\n${shiftLines.join('\n')}`
        cell.font = { size: 9, color: { argb: 'FF17365D' } }
        const colorIndex = shiftColorById.get(schedulesForDate[0].shift_template.id) ?? 0
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: shiftFills[colorIndex % shiftFills.length] },
        }
        maxLines = Math.max(maxLines, 1 + shiftLines.length)
      })

      row.height = Math.min(76, Math.max(42, maxLines * 16))
      rowNumber += 1
    }
  }

  return {
    lastContentRow: rowNumber - 1,
    nextRow: rowNumber + 2,
  }
}

function renderNoData(sheet: Worksheet) {
  sheet.mergeCells('A4:G7')
  const cell = sheet.getCell('A4')
  cell.value = '選擇的期間內沒有排班資料'
  cell.font = { size: 12, color: { argb: 'FF7A8491' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } }
  cell.border = calendarBorder
}

function columnLetter(columnNumber: number) {
  let value = columnNumber
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function configureIntegratedWorksheet(
  sheet: Worksheet,
  versionLabel: string,
  dateFrom: string,
  dateTo: string,
  employeeCount: number,
) {
  sheet.properties.defaultRowHeight = 18
  sheet.views = [{
    state: 'frozen',
    xSplit: 2,
    ySplit: 3,
    topLeftCell: 'C4',
    showGridLines: false,
  }]
  sheet.columns = [
    { width: 11 },
    { width: 8 },
    ...Array.from({ length: employeeCount }, () => ({ width: 17 })),
  ]
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: false,
    scale: 85,
    pageOrder: 'overThenDown',
    horizontalCentered: false,
    printTitlesRow: '3:3',
    printTitlesColumn: 'A:B',
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.25,
    },
  }
  sheet.headerFooter.oddFooter = `&L${versionLabel}&C${dateFrom} ~ ${dateTo}&R第 &P / &N 頁`
}

function styleIntegratedTitleRow(
  sheet: Worksheet,
  rowNumber: number,
  lastColumn: number,
  value: string,
  size: number,
  color: string,
) {
  sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn)
  const cell = sheet.getCell(rowNumber, 1)
  cell.value = value
  cell.font = { bold: rowNumber === 1, size, color: { argb: color } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

function integratedScheduleCellValue(schedules: Schedule[]) {
  return schedules.map((schedule) => (
    `${schedule.shift_template.name}\n${schedule.shift_template.start_time.slice(0, 5)}-${schedule.shift_template.end_time.slice(0, 5)}`
  )).join('\n')
}

function renderIntegratedSchedule(
  sheet: Worksheet,
  groups: EmployeeScheduleGroup[],
  dateFrom: string,
  dateTo: string,
  versionLabel: string,
  shiftColorById: Map<number, number>,
) {
  const lastColumn = groups.length + 2
  const lastColumnLetter = columnLetter(lastColumn)
  configureIntegratedWorksheet(sheet, versionLabel, dateFrom, dateTo, groups.length)

  styleIntegratedTitleRow(sheet, 1, lastColumn, `${versionLabel}｜整合班表`, 16, 'FF17365D')
  styleIntegratedTitleRow(sheet, 2, lastColumn, `${dateFrom} ～ ${dateTo}`, 10, 'FF5B6573')
  sheet.getRow(1).height = 27
  sheet.getRow(2).height = 20

  const headerRow = sheet.getRow(3)
  headerRow.height = 49
  const headerValues = ['日期', '星期']
  groups.forEach((group) => {
    headerValues.push([group.employeeId, group.name, group.position].filter(Boolean).join('\n'))
  })
  headerValues.forEach((value, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = value
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = calendarBorder
  })

  const scheduleByEmployeeAndDate = new Map<string, Schedule[]>()
  for (const group of groups) {
    for (const schedule of group.schedules) {
      const key = `${group.id}:${schedule.schedule_date}`
      const schedulesForCell = scheduleByEmployeeAndDate.get(key) ?? []
      schedulesForCell.push(schedule)
      scheduleByEmployeeAndDate.set(key, schedulesForCell)
    }
  }

  let rowNumber = 4
  let activeMonth = ''
  for (
    let date = parseDate(dateFrom);
    date <= parseDate(dateTo);
    date = addDays(date, 1)
  ) {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    if (monthKey !== activeMonth) {
      activeMonth = monthKey
      const monthRow = sheet.getRow(rowNumber)
      sheet.mergeCells(rowNumber, 1, rowNumber, 2)
      monthRow.getCell(1).value = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
      for (let column = 1; column <= lastColumn; column += 1) {
        const cell = monthRow.getCell(column)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } }
        cell.font = { bold: true, size: 10, color: { argb: 'FF17365D' } }
        cell.alignment = { horizontal: column <= 2 ? 'center' : 'left', vertical: 'middle' }
        cell.border = calendarBorder
      }
      monthRow.height = 23
      rowNumber += 1
    }

    const dateKey = formatDate(date)
    const weekday = date.getDay()
    const isWeekend = weekday === 0 || weekday === 6
    const row = sheet.getRow(rowNumber)
    row.getCell(1).value = `${date.getMonth() + 1}/${date.getDate()}`
    row.getCell(2).value = weekdayShortLabels[weekday]
    row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF334155' } }
    row.getCell(2).font = {
      bold: true,
      size: 10,
      color: { argb: isWeekend ? 'FFB45309' : 'FF334155' },
    }

    let maxLines = 1
    groups.forEach((group, employeeIndex) => {
      const cell = row.getCell(employeeIndex + 3)
      const schedulesForCell = scheduleByEmployeeAndDate.get(`${group.id}:${dateKey}`) ?? []
      if (schedulesForCell.length === 0) {
        cell.value = '未排班'
        cell.font = { size: 9, color: { argb: 'FF8A94A3' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isWeekend ? 'FFFFF7ED' : 'FFFFFFFF' },
        }
        return
      }

      cell.value = integratedScheduleCellValue(schedulesForCell)
      cell.font = { size: 9, color: { argb: 'FF17365D' } }
      const colorIndex = shiftColorById.get(schedulesForCell[0].shift_template.id) ?? 0
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: shiftFills[colorIndex % shiftFills.length] },
      }
      maxLines = Math.max(maxLines, schedulesForCell.length * 2)
    })

    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column)
      cell.border = calendarBorder
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      if (column <= 2) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isWeekend ? 'FFFFE8D6' : 'FFEFF3F8' },
        }
      }
    }
    row.height = Math.min(72, Math.max(31, maxLines * 14))
    rowNumber += 1
  }

  const scheduledDaysRow = sheet.getRow(rowNumber)
  const totalHoursRow = sheet.getRow(rowNumber + 1)
  scheduledDaysRow.getCell(1).value = '排班天數'
  totalHoursRow.getCell(1).value = '總工時'
  sheet.mergeCells(rowNumber, 1, rowNumber, 2)
  sheet.mergeCells(rowNumber + 1, 1, rowNumber + 1, 2)

  groups.forEach((group, employeeIndex) => {
    const dates = new Set(group.schedules.map((schedule) => schedule.schedule_date))
    const totalHours = group.schedules.reduce((total, schedule) => {
      const hours = Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0)
      return total + (Number.isFinite(hours) ? hours : 0)
    }, 0)
    scheduledDaysRow.getCell(employeeIndex + 3).value = dates.size
    totalHoursRow.getCell(employeeIndex + 3).value = Math.round(totalHours * 10) / 10
    totalHoursRow.getCell(employeeIndex + 3).numFmt = '0.0'
  })

  for (const summaryRow of [scheduledDaysRow, totalHoursRow]) {
    summaryRow.height = 23
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = summaryRow.getCell(column)
      cell.font = { bold: true, size: 10, color: { argb: 'FF17365D' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3FF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = calendarBorder
    }
  }

  const noteRowNumber = rowNumber + 3
  const noteRow = sheet.getRow(noteRowNumber)
  noteRow.getCell(1).value = '說明'
  sheet.mergeCells(noteRowNumber, 2, noteRowNumber, lastColumn)
  noteRow.getCell(2).value = '「未排班」不代表已核准休假；班別時間以排班版本內容為準。'
  noteRow.getCell(1).font = { bold: true, color: { argb: 'FF17365D' } }
  noteRow.getCell(2).font = { size: 9, color: { argb: 'FF5B6573' } }
  noteRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  noteRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  for (let column = 1; column <= lastColumn; column += 1) {
    noteRow.getCell(column).border = calendarBorder
    noteRow.getCell(column).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF7F9FC' },
    }
  }
  noteRow.height = 26
  sheet.pageSetup.printArea = `A1:${lastColumnLetter}${noteRowNumber}`
}

export async function createScheduleWorkbook({
  schedules,
  employees,
  dateFrom,
  dateTo,
  versionLabel,
  layout,
}: CreateScheduleWorkbookParams) {
  const excelJsModule = await import('exceljs')
  const WorkbookConstructor = (
    excelJsModule as unknown as {
      Workbook?: typeof import('exceljs')['Workbook']
      default?: { Workbook: typeof import('exceljs')['Workbook'] }
    }
  ).Workbook ?? (
    excelJsModule as unknown as {
      default: { Workbook: typeof import('exceljs')['Workbook'] }
    }
  ).default.Workbook
  const workbook = new WorkbookConstructor()
  workbook.creator = 'AI Scheduling'
  workbook.created = new Date()

  const shiftColorById = new Map<number, number>()
  for (const schedule of schedules) {
    if (!shiftColorById.has(schedule.shift_template.id)) {
      shiftColorById.set(schedule.shift_template.id, shiftColorById.size)
    }
  }

  if (layout === 'personal') {
    const employeeGroups = groupSchedulesByEmployee(schedules)
    const months = buildMonthSections(dateFrom, dateTo)
    const sheet = workbook.addWorksheet('個人版表')
    configureWorksheet(sheet, versionLabel, dateFrom, dateTo)
    renderWorkbookHeader(sheet, versionLabel, dateFrom, dateTo)

    if (employeeGroups.length === 0) {
      renderNoData(sheet)
      sheet.pageSetup.printArea = 'A1:G7'
    } else {
      let nextRow = 4
      let lastContentRow = 2
      employeeGroups.forEach((group, index) => {
        const rendered = renderEmployeeBlock(
          sheet,
          nextRow,
          group,
          months,
          dateFrom,
          dateTo,
          shiftColorById,
        )
        lastContentRow = rendered.lastContentRow
        nextRow = rendered.nextRow
        if (index < employeeGroups.length - 1) {
          sheet.getRow(rendered.nextRow - 1).addPageBreak()
        }
      })
      sheet.pageSetup.printArea = `A1:G${lastContentRow}`
    }
  } else {
    const employeeGroups = groupSchedulesByEmployee(schedules, employees)
    const sheet = workbook.addWorksheet('整合班表')
    renderIntegratedSchedule(
      sheet,
      employeeGroups,
      dateFrom,
      dateTo,
      versionLabel,
      shiftColorById,
    )
  }

  return workbook.xlsx.writeBuffer()
}
