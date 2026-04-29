import { useState } from 'react'
import { Download, DollarSign, Clock, TrendingUp, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const mockOvertime = [
  { id: 1, name: '黃雅婷', branch: '板橋店', hours_134: 8.5, hours_167: 2.0, hours_200: 0,   total_pay: 5120 },
  { id: 2, name: '王小明', branch: '中山店', hours_134: 4.0, hours_167: 0,   hours_200: 0,   total_pay: 1680 },
  { id: 3, name: '陳志明', branch: '中山店', hours_134: 10.0, hours_167: 4.0, hours_200: 0,  total_pay: 6840 },
  { id: 4, name: '張俊宏', branch: '中山店', hours_134: 6.0, hours_167: 2.5, hours_200: 8.0, total_pay: 9200 },
  { id: 5, name: '李大華', branch: '中山店', hours_134: 2.0, hours_167: 0,   hours_200: 0,   total_pay: 640 },
]

export default function OvertimePage() {
  const [month, setMonth] = useState('2026-04')

  const totalHours = mockOvertime.reduce((s, o) => s + o.hours_134 + o.hours_167 + o.hours_200, 0)
  const total134 = mockOvertime.reduce((s, o) => s + o.hours_134, 0)
  const total167 = mockOvertime.reduce((s, o) => s + o.hours_167, 0)
  const totalPay = mockOvertime.reduce((s, o) => s + o.total_pay, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">加班管理</h1>
          <p className="text-muted-foreground mt-1">自動依勞基法 §24 試算加班費（1.34、1.67、2.0 倍）</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />匯出薪資單
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">本月總加班</span>
              <span className="rounded-full p-1.5 bg-amber-100 text-amber-600"><Clock className="h-4 w-4" /></span>
            </div>
            <div className="text-2xl font-bold mt-2">{totalHours} <span className="text-sm text-muted-foreground font-normal">小時</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">1.34 倍（平日前 2h）</span>
              <span className="rounded-full p-1.5 bg-sky-100 text-sky-600"><TrendingUp className="h-4 w-4" /></span>
            </div>
            <div className="text-2xl font-bold mt-2 text-sky-600">{total134} <span className="text-sm font-normal text-muted-foreground">h</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">1.67 倍（平日後 2h）</span>
              <span className="rounded-full p-1.5 bg-amber-100 text-amber-600"><TrendingUp className="h-4 w-4" /></span>
            </div>
            <div className="text-2xl font-bold mt-2 text-amber-600">{total167} <span className="text-sm font-normal text-muted-foreground">h</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">預估加班費</span>
              <span className="rounded-full p-1.5 bg-emerald-100 text-emerald-600"><DollarSign className="h-4 w-4" /></span>
            </div>
            <div className="text-2xl font-bold mt-2 text-emerald-600">NT$ {totalPay.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>員工加班明細</CardTitle>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto rounded-b-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  {['員工', '分店', '1.34 倍（平日前 2h）', '1.67 倍（平日後 2h）', '2.0 倍（休息日）', '試算金額', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockOvertime.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.branch}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">{o.hours_134} h</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{o.hours_167} h</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{o.hours_200} h</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">NT$ {o.total_pay.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost">
                        <Eye className="h-3.5 w-3.5 mr-1" />詳情
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm">合計</td>
                  <td className="px-4 py-3 font-mono">NT$ {totalPay.toLocaleString()}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">加班費計算規則（勞基法 §24）</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border p-4 bg-sky-50/40">
            <div className="text-sky-700 font-semibold">平日前 2 小時</div>
            <div className="text-3xl font-bold mt-1">× 1.34</div>
            <div className="text-xs text-muted-foreground mt-1">§24-I-1</div>
          </div>
          <div className="rounded-lg border p-4 bg-amber-50/40">
            <div className="text-amber-700 font-semibold">平日後 2 小時</div>
            <div className="text-3xl font-bold mt-1">× 1.67</div>
            <div className="text-xs text-muted-foreground mt-1">§24-I-2</div>
          </div>
          <div className="rounded-lg border p-4 bg-rose-50/40">
            <div className="text-rose-700 font-semibold">休息日 / 例假</div>
            <div className="text-3xl font-bold mt-1">× 2.0+</div>
            <div className="text-xs text-muted-foreground mt-1">§24-II / §39</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
