import type { Schedule } from '@/types/schedule'
import type { ShiftTemplate } from '@/types/shift'

type CandidateSchedule = {
  id?: number
  scheduleVersionId: number
  employeeId: number
  scheduleDate: string
  startTime: string
  endTime: string
}

function interval(candidate: CandidateSchedule) {
  const start = new Date(`${candidate.scheduleDate}T${candidate.startTime.slice(0, 5)}:00`)
  const end = new Date(`${candidate.scheduleDate}T${candidate.endTime.slice(0, 5)}:00`)
  if (end <= start) end.setDate(end.getDate() + 1)
  return { start: start.getTime(), end: end.getTime() }
}

function fromSchedule(schedule: Schedule): CandidateSchedule {
  return {
    id: schedule.id,
    scheduleVersionId: schedule.schedule_version,
    employeeId: schedule.employee.id,
    scheduleDate: schedule.schedule_date,
    startTime: schedule.shift_template.start_time,
    endTime: schedule.shift_template.end_time,
  }
}

function overlaps(left: CandidateSchedule, right: CandidateSchedule) {
  if (left.scheduleVersionId === right.scheduleVersionId) return false
  if (left.employeeId !== right.employeeId) return false
  const leftInterval = interval(left)
  const rightInterval = interval(right)
  return leftInterval.start < rightInterval.end && rightInterval.start < leftInterval.end
}

export function buildCrossVersionWarningMap(schedules: Schedule[]) {
  const map = new Map<number, Schedule[]>()
  for (let leftIndex = 0; leftIndex < schedules.length; leftIndex += 1) {
    const left = schedules[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < schedules.length; rightIndex += 1) {
      const right = schedules[rightIndex]
      if (!overlaps(fromSchedule(left), fromSchedule(right))) continue
      map.set(left.id, [...(map.get(left.id) ?? []), right])
      map.set(right.id, [...(map.get(right.id) ?? []), left])
    }
  }
  return map
}

export function findCandidateCrossVersionOverlaps(
  candidate: {
    scheduleId?: number
    scheduleVersionId: number
    employeeId: number
    scheduleDate: string
    shiftTemplateId: number
  },
  schedules: Schedule[],
  templates: ShiftTemplate[],
) {
  const template = templates.find((item) => item.id === candidate.shiftTemplateId)
  if (!template) return []
  const normalized: CandidateSchedule = {
    id: candidate.scheduleId,
    scheduleVersionId: candidate.scheduleVersionId,
    employeeId: candidate.employeeId,
    scheduleDate: candidate.scheduleDate,
    startTime: template.start_time,
    endTime: template.end_time,
  }
  return schedules.filter((schedule) => (
    schedule.id !== candidate.scheduleId
    && overlaps(normalized, fromSchedule(schedule))
  ))
}
