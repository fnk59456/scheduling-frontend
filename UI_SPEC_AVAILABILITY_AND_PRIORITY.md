# UI 規格 · 員工可用性 & 班別員工優先順序

> 最小可交付 UI 規格（MVP）
> 對應後端：`scheduling-api-main` 2026-04 新增 API
> 對應前端型別：`src/types/employee.ts` / `src/types/shift.ts`
> 對應 API client：`src/api/endpoints/employees.ts` / `src/api/endpoints/shifts.ts`

設計系統：**shadcn/ui + Tailwind**（沿用現有 `Button / Card / Dialog / Select / Input / Label / Badge` 等元件，不要另外引入 UI 庫）。

---

## 1. 員工可用性 UI（EmployeeAvailabilityPanel）

### 1.1 放置位置

- 頁面：`src/pages/employees/EmployeeDetailPage.tsx`
- 形式：新增一張 `Card`，放在「基本資料」/「證照」卡片 **下方**、「契約記錄」**上方**
- 標題：`可用性與偏好時段`
- 元件檔：`src/pages/employees/EmployeeAvailabilityPanel.tsx`（獨立檔，props 只需 `employeeId`）

### 1.2 功能目標

1. 顯示 / 編輯該員工的「每週要求工時 `required_hours_per_week`」與「備註 `special_rules`」
2. 顯示 / 新增 / 刪除「時段 `time_slots`」（分為 `blocked` 不可排 / `preferred` 偏好排）
3. 支援「還沒建立 availability」的空狀態（GET 回傳 204 → `null`）

### 1.3 資料來源（API）

| 動作 | Client 方法 | 備註 |
| --- | --- | --- |
| 讀取 | `employeesApi.getAvailability(employeeId)` | 204 時回傳 `null` |
| 首次建立 / 整批覆寫 | `employeesApi.putAvailability(employeeId, data)` | `time_slots` 會被全量替換 |
| 更新基本欄位 | `employeesApi.patchAvailability(employeeId, data)` | 不傳 `time_slots` 就保留既有 |
| 新增一筆時段 | `employeesApi.addTimeSlot(employeeId, slot)` | 不影響其他時段 |
| 刪除一筆時段 | `employeesApi.removeTimeSlot(employeeId, slotId)` | 204 |

### 1.4 React Query Hooks（需新增）

新增至 `src/hooks/useEmployees.ts`：

```ts
// key
const availabilityKey = (id: number) => ['employees', id, 'availability']

useEmployeeAvailability(employeeId)              // useQuery
usePutEmployeeAvailability()                     // useMutation（首次建立用）
usePatchEmployeeAvailability()                   // useMutation（更新標頭欄位）
useAddEmployeeTimeSlot()                         // useMutation
useRemoveEmployeeTimeSlot()                      // useMutation
```

所有 mutation `onSuccess` 都要 `qc.invalidateQueries({ queryKey: availabilityKey(employeeId) })`，並沿用既有 `toast()` 成功/失敗訊息風格。

### 1.5 Component state 結構

```ts
type HeaderForm = {
  required_hours_per_week: string   // 空字串 = null
  special_rules: string
  effective_from: string            // '' = null
  effective_to: string              // '' = null
}

type SlotForm = {
  slot_type: SlotType               // 'blocked' | 'preferred'
  day_of_week: '' | '0' | '1' | '2' | '3' | '4' | '5' | '6'  // '' = 每天 (null)
  start_time: string                // 'HH:mm'
  end_time: string                  // 'HH:mm'
  label: string
}
```

> 表單統一用 string 儲存，送出前再轉型，避免 controlled input warning。

### 1.6 版型（Card 內部）

```
┌────────────────────────────────────────────────────────────┐
│ 可用性與偏好時段                            [ 儲存設定 ]     │
│ 不含時段的設定說明                                          │
├────────────────────────────────────────────────────────────┤
│ [每週要求工時]  [備註]                                      │
│ [生效起日]      [生效迄日]                                  │
├────────────────────────────────────────────────────────────┤
│  時段 (5)                          [ + 新增時段 ]           │
│                                                            │
│  ┌ 週一 09:00–18:00  [不可排]  備註: 接小孩  [🗑]          │
│  ┌ 每天 12:00–13:00  [偏好]    備註: 午餐    [🗑]          │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

- 時段列：左側用 `Badge`（`blocked` = `destructive` 紅、`preferred` = `default` 綠/主題色）
- 每列右側 `Trash2` icon button（`variant="ghost"`）
- 沒資料時：`text-sm text-muted-foreground py-6 text-center` 顯示「尚未設定任何時段」
- 尚未建立 availability（`data === null`）：顯示一個中央 CTA「建立可用性設定」，按下去就用空 header + 空 slots 呼叫 `PUT`

### 1.7 驗證規則

| 欄位 | 規則 | 錯誤訊息 |
| --- | --- | --- |
| `required_hours_per_week` | 空 或 `0 ≤ n ≤ 168` | `每週工時需介於 0–168` |
| `start_time` / `end_time` | HTML `type="time"` 必填 | `請輸入時間` |
| 時段跨午夜 | `end_time <= start_time` 時擋下，或明確提示 | `結束時間需晚於開始時間（跨午夜尚未支援）` |
| 單筆時段重疊 | **前端不擋，交給後端回錯誤**；`onError` 用 toast 顯示後端訊息 | 使用 `error.response?.data?.detail` |
| `effective_from / to` | 兩個都填時 `from <= to` | `生效起日需早於或等於迄日` |

### 1.8 「新增時段」Dialog

- 觸發：Card header 的 `+ 新增時段` 按鈕
- 欄位：`slot_type` (Select)、`day_of_week` (Select，第一項 `每天`)、`start_time` / `end_time` (time input)、`label` (Input，選填)
- 成功呼叫 `addTimeSlot` 後關閉 dialog，重設表單

### 1.9 儲存流程

- 「儲存設定」按鈕：
  - 若 `availability === null` → 呼叫 `putAvailability`，payload 包含 `time_slots: []`（初次建立）
  - 否則 → 呼叫 `patchAvailability`，**不帶 `time_slots`**（時段用單筆 API 維護，避免誤刪）
- `isPending` 時禁用按鈕 + 顯示 `Loader2` spinner（沿用既有模式）

### 1.10 Edge cases

- `required_hours_per_week` 來自後端是字串 (`"32.00"`) 或 `null`，render 時要 `value ?? ''`
- 刪除時段：樂觀更新可選；最簡做法是 `invalidateQueries` 重抓一次
- 時段陣列 `time_slots` 顯示前先排序：`day_of_week ?? -1` → `start_time`

---

## 2. 班別員工優先順序 UI（ShiftEmployeePrioritiesDialog）

### 2.1 放置位置

- 頁面：`src/pages/settings/ShiftTemplatesPage.tsx`
- 形式：在每張班別卡片右下加一顆按鈕 `員工優先順序`（`variant="outline" size="sm"`），點了開 Dialog
- 元件檔：`src/pages/settings/ShiftEmployeePrioritiesDialog.tsx`（props: `shiftId`、`shiftName`、`organizationId`、`open`、`onOpenChange`）

### 2.2 功能目標

1. 讀取該班別目前的員工優先清單
2. 編輯：新增員工、移除員工、調整順序（拖曳或上下箭頭）、設定 `max_extra_shifts`
3. 一次整批儲存（後端是 `PUT` 全量覆寫）

### 2.3 資料來源（API）

| 動作 | Client 方法 | 備註 |
| --- | --- | --- |
| 讀取 | `shiftTemplatesApi.getEmployeePriorities(shiftId)` | 回傳 array（無資料 = `[]`） |
| 儲存 | `shiftTemplatesApi.putEmployeePriorities(shiftId, items)` | 全量覆寫；`employee` 欄位是 id，**不是 `employee_id`** |
| 員工清單 | `employeesApi.list({ organization, is_active: true })` | 用來新增員工下拉 |

### 2.4 React Query Hooks（需新增）

新增至 `src/hooks/useShifts.ts`：

```ts
const prioritiesKey = (shiftId: number) => ['shiftTemplates', shiftId, 'priorities']

useShiftEmployeePriorities(shiftId)              // useQuery, enabled: !!shiftId
usePutShiftEmployeePriorities()                  // useMutation -> invalidate prioritiesKey + TEMPLATES_KEY
```

### 2.5 Component state 結構

```ts
type Row = {
  employee: number
  employee_name: string            // 僅 UI 顯示用，送出時不帶
  max_extra_shifts: string         // '' = null，其他 = '0'..'99'
}

const [rows, setRows] = useState<Row[]>([])
const [selectedEmployee, setSelectedEmployee] = useState<string>('')
```

送出時：

```ts
const payload: ShiftEmployeePriorityUpdateItem[] = rows.map((r, idx) => ({
  employee: r.employee,
  priority_rank: idx + 1,                                         // 依陣列順序重新編號
  max_extra_shifts: r.max_extra_shifts === '' ? null : Number(r.max_extra_shifts),
}))
```

### 2.6 版型（Dialog 內部）

```
┌ Dialog ─────────────────────────────────────────┐
│ 員工優先順序 · 早班                               │
│ 數字越小越優先，max_extra_shifts 空白=不限        │
├─────────────────────────────────────────────────┤
│ 新增員工: [ 選擇員工 ▼ ]   [ + 加入 ]            │
├─────────────────────────────────────────────────┤
│ #1  王小明        max_extra: [  2  ]  [↑][↓][✕] │
│ #2  李大華        max_extra: [    ]  [↑][↓][✕] │
│ #3  陳志明        max_extra: [  1  ]  [↑][↓][✕] │
├─────────────────────────────────────────────────┤
│                  [ 取消 ]         [ 儲存 ]       │
└─────────────────────────────────────────────────┘
```

- 每列顯示的 `#N` = 陣列索引 + 1（不用讓使用者輸入）
- 「↑ / ↓」= swap `rows[i]` 與 `rows[i-1]` / `rows[i+1]`
- 「✕」= `rows.filter((_, idx) => idx !== i)`
- 新增員工下拉：用 `useEmployees({ organization, is_active: true })`，過濾掉已在 `rows` 裡的 `employee`，空清單時按鈕 disabled

### 2.7 驗證規則

| 欄位 | 規則 | 錯誤訊息 |
| --- | --- | --- |
| `max_extra_shifts` | 空字串 OR 整數 `0–99` | `請輸入 0–99 的整數` |
| 員工不可重複 | 加入前檢查 `rows.some(r => r.employee === id)` | `此員工已在清單中` |
| 空清單 | 允許（= 清空該班別優先設定）、但送出前 `confirm('確定要清空所有優先順序？')` | — |

### 2.8 儲存流程

- 儲存成功：
  - `toast({ title: '已更新', description: '員工優先順序已儲存' })`
  - 關閉 Dialog
  - `invalidateQueries` 讓 `ShiftTemplatesPage` 列表如果有顯示優先人數也會刷新
- 儲存失敗：`toast({ variant: 'destructive' })`，Dialog 保留不關，讓使用者修正

### 2.9 拖曳排序（選配，可放第 2 版）

> MVP 先只做上下箭頭；拖曳排序要引入 `@dnd-kit/core` 比較重，留到真的有需求再做。

### 2.10 Edge cases

- 同一個班別可能還沒設定任何優先員工 → `rows = []`，正常顯示「尚未加入員工」
- `ShiftTemplate` 有 `organization`，新增員工下拉一定要帶這個 org 過濾，不然會跨組織選到人
- 後端 `priority_rank` 允許重複（舊資料可能如此），前端送出時一律用陣列索引重編號，讓資料收斂

---

## 3. 共用規範

### 3.1 Loading / Empty / Error

- Loading：`<Loader2 className="h-6 w-6 animate-spin text-primary" />` + `text-sm text-muted-foreground`
- Empty：`py-8 text-center text-muted-foreground`
- Error：透過 `toast` 顯示後端 `error.response?.data?.detail ?? '發生未預期錯誤'`

### 3.2 Toast 文案（沿用現有風格）

| 情境 | title | description |
| --- | --- | --- |
| 可用性儲存 OK | `儲存成功` | `可用性設定已更新` |
| 時段新增 OK | `新增成功` | `時段已加入` |
| 時段移除 OK | `移除成功` | `時段已刪除` |
| 優先順序儲存 OK | `更新成功` | `員工優先順序已儲存` |
| 任何失敗 | `儲存失敗` / `操作失敗` | 後端 `detail` 或 `無法完成操作` |

### 3.3 驗收清單（DoD）

員工可用性：

- [ ] 未建立狀態能看到 CTA 並一鍵建立
- [ ] Header 欄位 patch 後刷新不會遺失 time_slots
- [ ] 新增 / 刪除時段後畫面立即更新
- [ ] 後端回 400 時有 toast 顯示原因
- [ ] `required_hours_per_week` 空字串 / `null` 可正常來回

班別員工優先順序：

- [ ] 可新增員工、排序、刪除、設定 `max_extra_shifts`
- [ ] 儲存後重新開啟 Dialog 順序正確
- [ ] 清空後儲存可成功（後端允許空陣列）
- [ ] 送出 payload 欄位名是 `employee`（不是 `employee_id`）
- [ ] 新增下拉只顯示同組織、在職、且尚未加入的員工

---

## 4. 建議實作順序

1. `src/hooks/useEmployees.ts` 加 5 個 availability hooks
2. `src/pages/employees/EmployeeAvailabilityPanel.tsx` + 掛到 `EmployeeDetailPage`
3. `src/hooks/useShifts.ts` 加 2 個 priorities hooks
4. `src/pages/settings/ShiftEmployeePrioritiesDialog.tsx` + 在 `ShiftTemplatesPage` 的卡片加觸發按鈕
5. 手動跑過驗收清單，commit

預估工時：熟手約 0.5–1 天；加測試再抓 +0.5 天。
