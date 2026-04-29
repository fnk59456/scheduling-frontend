import { useState, useRef, useEffect } from 'react'
import { Send, Brain, User, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  refs?: { law: string; note: string }[]
}

const cannedResponses: Record<string, { reply: string; refs: { law: string; note: string }[] }> = {
  '加班費怎麼算？': {
    reply: '依《勞動基準法》§24，平日加班費的計算方式如下：\n\n• 前 2 小時：按平日每小時工資 × 1.34\n• 第 3~4 小時：按平日每小時工資 × 1.67\n• 休息日加班：前 2 小時 × 1.34、後續 × 1.67\n• 例假、國定假日加班：× 2.0 以上，且須徵得員工同意\n\n系統已在「加班管理」頁面依此公式自動試算，無需手動計算。',
    refs: [{ law: '勞基法 §24', note: '延長工時工資加給' }, { law: '勞基法 §39', note: '例假、休假工資加倍' }],
  },
  '特休天數規定': {
    reply: '依《勞基法》§38，特休假依年資計算：\n\n• 滿 6 個月：3 日\n• 滿 1 年：7 日\n• 滿 2 年：10 日\n• 滿 3 年：14 日\n• 滿 5 年：15 日\n• 滿 10 年：每年再加 1 日，最高 30 日',
    refs: [{ law: '勞基法 §38', note: '特別休假' }],
  },
  '大夜班限制': {
    reply: '關於大夜班（22:00-06:00）排班限制：\n\n• 與前班次需間隔至少 11 小時（§34）\n• 女性員工夜間工作須經同意並提供必要設施（§49）\n• 建議連續輪排大夜班不超過 4 週，避免疲勞累積',
    refs: [{ law: '勞基法 §34', note: '夜間工作休息' }, { law: '勞基法 §49', note: '女性夜間工作' }],
  },
  '例假與休息日差別': {
    reply: '依《勞基法》§36「一例一休」規定：\n\n• 例假：每 7 日至少 1 日，原則上不得出勤（除天災事變）\n• 休息日：每 7 日至少 1 日，可加班但需給加倍工資\n\n簡單記：例假「不能排」，休息日「可以排但很貴」。',
    refs: [{ law: '勞基法 §36', note: '例假與休息日' }],
  },
  '連續出勤上限': {
    reply: '依《勞基法》§36，勞工每 7 日應有 1 日例假，因此連續出勤最多為 6 天。\n\n若超過此限制，系統將在「合規檢查」頁面標示為嚴重違規，請立即安排休息日。',
    refs: [{ law: '勞基法 §36', note: '例假規定' }],
  },
  '女性夜間工作': {
    reply: '《勞基法》§49 規定，僱主不得使女性員工於晚上 10 時至翌晨 6 時工作，除非：\n\n1. 經工會或勞資會議同意\n2. 提供必要安全衛生設施\n3. 無大眾運輸工具可利用時提供交通工具或安排女性宿舍',
    refs: [{ law: '勞基法 §49', note: '女性夜間工作' }],
  },
}

const faqChips = ['加班費怎麼算？', '特休天數規定', '大夜班限制', '例假與休息日差別', '連續出勤上限', '女性夜間工作']

const lawRefs = [
  { law: '§24', title: '延長工時工資（加班費）' },
  { law: '§30', title: '正常工時（每日 8、每週 40）' },
  { law: '§32', title: '延長工時上限' },
  { law: '§34', title: '輪班間隔 11 小時' },
  { law: '§36', title: '例假與休息日' },
  { law: '§38', title: '特別休假' },
  { law: '§49', title: '女性夜間工作' },
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '您好！我是勞基法合規助手。可以問我關於加班費、休息時間、排班規定等問題，我會引用條文並給出符合您機構情境的建議。',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  const send = (text?: string) => {
    const t = (text ?? input).trim()
    if (!t) return
    setMessages((m) => [...m, { role: 'user', content: t }])
    setInput('')
    setSending(true)
    setTimeout(() => {
      const canned = cannedResponses[t]
      const reply = canned
        ? canned.reply
        : `我理解您想了解「${t}」。以下是相關的勞基法分析：\n\n根據現行《勞動基準法》相關條文，本類問題通常涉及工時、休息、加班計算等核心議題。建議您：\n\n1. 先對照系統的合規掃描結果\n2. 檢視員工可用性設定是否合理\n3. 透過 AI 自動排班避免人為疏失`
      const refs = canned?.refs ?? [{ law: '勞基法總論', note: '一般合規建議' }]
      setMessages((m) => [...m, { role: 'assistant', content: reply, refs }])
      setSending(false)
    }, 900)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI 法規助手</h1>
        <p className="text-muted-foreground mt-1">基於《勞動基準法》的智慧問答 · 引用條文並結合您機構的實際情境</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 16rem)' }}>
          <CardHeader className="flex-row items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm">勞基法助手 · Claude</CardTitle>
                <CardDescription>已載入最新勞基法修訂（2024-12）</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />線上
            </Badge>
          </CardHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                  m.role === 'user'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                )}>
                  {m.role === 'user' ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
                </div>
                <div className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted rounded-tl-sm'
                )}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.refs && (
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-border/40">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">引用條文</div>
                      {m.refs.map((r, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="bg-background font-mono">{r.law}</Badge>
                          <span className="text-muted-foreground">{r.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 200, 400].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {faqChips.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="輸入您的問題，例如：加班費怎麼算？"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <Button onClick={() => send()} disabled={!input.trim() || sending}>
                <Send className="h-4 w-4 mr-1" />送出
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">常用條文快查</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {lawRefs.map((r) => (
                <button
                  key={r.law}
                  onClick={() => send(`請說明${r.law}${r.title}`)}
                  className="w-full flex items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <Badge variant="outline" className="font-mono shrink-0">{r.law}</Badge>
                  <span className="text-sm truncate">{r.title}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50/60 to-background border-indigo-200/60 dark:from-indigo-950/20 dark:border-indigo-800/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-medium mb-2">
                <Sparkles className="h-4 w-4" />提示
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI 回答僅供參考，重大勞資決策仍建議諮詢律師或勞動主管機關。系統已整合最新法規（2024-12 版）。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
