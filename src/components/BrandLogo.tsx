import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn('shrink-0 overflow-hidden', className)}>
      <img
        src="/scheduling-logo.png"
        alt="AI 智慧排班系統 Logo"
        className="h-full w-full scale-125 object-cover"
      />
    </div>
  )
}
