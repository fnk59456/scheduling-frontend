import type { ScheduleVersion } from '@/types/schedule'

export type VersionResolution = {
  version: ScheduleVersion | null
  conflicts: ScheduleVersion[]
}

const statusOrder: Record<ScheduleVersion['status'], number> = {
  draft: 0,
  published: 1,
  approved: 2,
  archived: 3,
}

export function versionCoversDate(version: ScheduleVersion, date: string) {
  return version.period_start <= date && date <= version.period_end
}

export function getTimelineVersions(
  versions: ScheduleVersion[],
  selectedVersion: ScheduleVersion | null,
  dateFrom: string,
  dateTo: string,
) {
  if (!selectedVersion) return []
  return versions.filter((version) => (
    version.organization === selectedVersion.organization
    && version.branch === selectedVersion.branch
    && version.version_type === selectedVersion.version_type
    && version.status !== 'archived'
    && version.period_start <= dateTo
    && version.period_end >= dateFrom
  ))
}

export function resolveVersionForDate(
  versions: ScheduleVersion[],
  selectedVersionId: number | null,
  date: string,
): VersionResolution {
  const candidates = versions.filter((version) => versionCoversDate(version, date))
  if (!candidates.length) return { version: null, conflicts: [] }

  const selected = candidates.find((version) => version.id === selectedVersionId)
  const sorted = [...candidates].sort((a, b) => (
    statusOrder[a.status] - statusOrder[b.status]
    || b.created_at.localeCompare(a.created_at)
  ))
  return {
    version: selected ?? sorted[0],
    conflicts: candidates.length > 1 ? candidates : [],
  }
}
