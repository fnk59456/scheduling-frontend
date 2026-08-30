import type { LeaveRequest } from '@/types/leave'
import type { Schedule } from '@/types/schedule'

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function approvedLeaveDateMap(leaves: LeaveRequest[]) {
  const map = new Map<string, LeaveRequest[]>()
  for (const leave of leaves) {
    if (leave.status !== 'approved') continue
    const end = parseLocalDate(leave.end_date)
    for (let date = parseLocalDate(leave.start_date); date <= end; date.setDate(date.getDate() + 1)) {
      const key = `${leave.employee}:${formatLocalDate(date)}`
      map.set(key, [...(map.get(key) ?? []), leave])
    }
  }
  return map
}

export function approvedLeaveFor(
  map: Map<string, LeaveRequest[]>,
  employeeId: number,
  date: string,
) {
  return map.get(`${employeeId}:${date}`) ?? []
}

export function isWorkingSchedule(schedule: Schedule) {
  return schedule.status !== 'cancelled' && schedule.status !== 'leave'
}

export function workingSchedules(schedules: Schedule[]) {
  return schedules.filter(isWorkingSchedule)
}
