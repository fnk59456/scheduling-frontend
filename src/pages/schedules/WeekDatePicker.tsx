import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type WeekDatePickerProps = {
  weekStart: Date
  onSelectDate: (date: Date) => void
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1} 月`)

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  return addDays(date, day === 0 ? -6 : 1 - day)
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function WeekDatePicker({ weekStart, onSelectDate }: WeekDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(weekStart.getFullYear())
  const [viewMonth, setViewMonth] = useState(weekStart.getMonth())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setViewYear(weekStart.getFullYear())
    setViewMonth(weekStart.getMonth())
  }, [open, weekStart])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const mondayOffset = (firstDay.getDay() + 6) % 7
    const gridStart = addDays(firstDay, -mondayOffset)
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [viewMonth, viewYear])

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const firstYear = Math.min(currentYear - 10, weekStart.getFullYear(), viewYear)
    const lastYear = Math.max(currentYear + 10, weekStart.getFullYear(), viewYear)
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
  }, [viewYear, weekStart])

  const selectedWeekStart = startOfWeek(weekStart)
  const selectedWeekEnd = addDays(selectedWeekStart, 6)
  const today = new Date()

  const changeMonth = (offset: number) => {
    const next = new Date(viewYear, viewMonth + offset, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const selectDate = (date: Date) => {
    onSelectDate(date)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-2 px-2.5 font-medium"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays className="h-4 w-4 text-primary" />
        <span>{formatDate(selectedWeekStart)} ～ {formatDate(selectedWeekEnd)}</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="選擇週排班日期"
          className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)] sm:translate-y-0"
        >
          <div className="mb-3 flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => changeMonth(-1)} aria-label="上一個月">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <select
                aria-label="選擇年份"
                value={viewYear}
                onChange={(event) => setViewYear(Number(event.target.value))}
                className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
              >
                {years.map((year) => <option key={year} value={year}>{year} 年</option>)}
              </select>
              <select
                aria-label="選擇月份"
                value={viewMonth}
                onChange={(event) => setViewMonth(Number(event.target.value))}
                className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
              >
                {monthLabels.map((label, month) => <option key={label} value={month}>{label}</option>)}
              </select>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => changeMonth(1)} aria-label="下一個月">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {weekdayLabels.map((label) => <div key={label} className="py-1">{label}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((date) => {
              const inViewedMonth = date.getMonth() === viewMonth
              const inSelectedWeek = date >= selectedWeekStart && date <= selectedWeekEnd
              const isWeekStart = isSameDay(date, selectedWeekStart)
              const isToday = isSameDay(date, today)

              return (
                <button
                  key={formatDate(date)}
                  type="button"
                  onClick={() => selectDate(date)}
                  aria-label={`選擇 ${formatDate(date)} 所在週`}
                  aria-pressed={inSelectedWeek}
                  className={cn(
                    'relative mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !inViewedMonth && 'text-muted-foreground/45',
                    inSelectedWeek && 'bg-primary/10 text-primary hover:bg-primary/15',
                    isWeekStart && 'bg-primary text-primary-foreground hover:bg-primary',
                    isToday && !isWeekStart && 'ring-1 ring-inset ring-primary/50',
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">點選任一天即可切換至該週</p>
            <Button type="button" variant="outline" size="sm" onClick={() => selectDate(today)}>今天</Button>
          </div>
        </div>
      )}
    </div>
  )
}
