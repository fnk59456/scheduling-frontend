import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PlaceholderPageProps {
  title: string
  description?: string
  weekLabel?: string
}

export default function PlaceholderPage({ title, description, weekLabel }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Construction className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">功能開發中</h2>
            <p className="text-muted-foreground mt-1">
              此功能預計{weekLabel ? `在${weekLabel}` : '稍後'}上線
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
