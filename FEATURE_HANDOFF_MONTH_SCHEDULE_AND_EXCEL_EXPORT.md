# 排班頁新增功能交接：員工月班表與 Excel 雙格式輸出

> 專案：AI 智慧排班系統前端  
> 頁面：`/schedules`  
> 日期：2026-07-30
> 異動範圍：前端功能與 Excel 輸出；本次不需要後端 migration 或新增 API

---

## 一、功能背景

本次調整處理兩個排班閱讀需求：

1. 週排班表適合日常操作，但不容易快速查看單一員工整個月的班次。
2. 原本 Excel 若依日期橫向延伸，時間區間較長時不利於閱讀、列印與交接。

因此新增：

- 員工欄位右下角的月班表 icon。
- 從該 icon 展開、並縮回同一 icon 的個人月班表 Dialog。
- 依月份與週次換行的「個人版表」Excel 輸出。
- 日期為列、員工為欄的「整合班表」Excel 輸出。
- 兩種格式皆維持單一工作表，不再建立每位員工一張工作表。

### 星期排列決策

- 主頁「週排班表」維持：**週一 → 週日**。
- 個人「月班表」與 Excel 月曆使用：**週日 → 週六**。

週排班表著重工作週操作；月班表與 Excel 則採一般月曆閱讀習慣，兩者刻意保留不同排列。

---

## 二、使用者操作流程

### 2.1 查看個人月班表

1. 進入「排班管理」。
2. 選擇機構及排班版本。
3. 在員工欄位右下角點擊月曆 icon。
4. Dialog 會從被點擊的 icon 位置放大展開。
5. 使用左右按鈕切換月份；可切換範圍受排班版本有效期間限制。
6. 關閉 Dialog 時，畫面會縮回原本被點擊的 icon。

月班表內容包括：

- 員工姓名、員工編號、職稱及版本名稱。
- 當月排班天數。
- 當月預計工時。
- 當月合規提醒數。
- 每日班別、起訖時間及合規警示。
- 未排班日期、非當月日期及版本有效期間外日期的差異樣式。
- 載入中、載入失敗及重新載入狀態。

### 2.2 匯出 Excel

1. 在排班頁點擊「匯出」。
2. 選擇起始及結束日期，日期不可超出目前排班版本有效期間。
3. 選擇輸出格式：
   - **個人版表**：每位員工以月曆呈現，依序集中在同一工作表；內容沿用原整合格式。
   - **整合班表**：日期向下、所有在職員工向右延伸，整份檔案只使用一張工作表。
4. 點擊「匯出 Excel」後，瀏覽器下載 `.xlsx` 檔案。

檔名格式：

```text
{版本名稱}_{個人版表或整合班表}_{起始日期}_{結束日期}.xlsx
```

---

## 三、程式檔案與責任

| 檔案 | 主要責任 |
|---|---|
| `src/pages/schedules/SchedulesPage.tsx` | 月班表 icon、點擊座標計算、Dialog 狀態、Excel 匯出表單、資料取得及 Blob 下載 |
| `src/pages/schedules/EmployeeMonthScheduleDialog.tsx` | 個人月班表內容、月份切換、月曆日期產生、班次及合規提醒呈現 |
| `src/lib/scheduleExcelExport.ts` | ExcelJS workbook 建立、個人月曆與整合矩陣配置、跨月分隔、統計、列印設定及樣式 |
| `src/api/endpoints/employees.ts` | `employeesApi.listAll()`，供整合班表取得所有分頁的在職員工 |
| `src/index.css` | 月班表 overlay、展開及收回動畫、減少動態效果設定 |
| `src/components/ui/dialog.tsx` | 共用 Radix Dialog；本次沿用既有元件，未建立月班表專用 Portal |

---

## 四、個人月班表實作

### 4.1 icon 與動畫起點

員工欄位中的 icon 使用原生 `button`，並提供 `title` 與 `aria-label`：

```tsx
onClick={(event) => openEmployeeMonthSchedule(employee, event.currentTarget)}
```

`openEmployeeMonthSchedule` 透過 `getBoundingClientRect()` 取得 icon 中心，再轉為相對於 viewport 中心的位移：

```ts
const rect = trigger.getBoundingClientRect()

setMonthDialogOrigin({
  x: rect.left + rect.width / 2 - window.innerWidth / 2,
  y: rect.top + rect.height / 2 - window.innerHeight / 2,
})
```

位移透過 CSS variables 傳入 Dialog：

```tsx
const dialogStyle = {
  '--month-dialog-x': `${origin.x}px`,
  '--month-dialog-y': `${origin.y}px`,
} as CSSProperties
```

### 4.2 動畫規則

展開動畫：

```css
transform: translate(var(--month-dialog-x), var(--month-dialog-y)) scale(0.055);
```

最後回到：

```css
transform: translate(0, 0) scale(1);
```

收回動畫採相反方向。

目前時間設定：

- Overlay 展開：220ms。
- Dialog 展開：280ms。
- Overlay 收回：180ms。
- Dialog 收回：210ms。

#### 重要維護注意事項

共用 `DialogContent` 已由 Tailwind v4 的獨立 `translate` 屬性處理置中：

```text
translate-x-[-50%] translate-y-[-50%]
```

因此 `monthScheduleDialogIn` / `monthScheduleDialogOut` **不可再加入**
`translate(-50%, -50%)`。若動畫 transform 再做一次置中，Dialog 會被重複位移，視覺上從左上角展開或收回。

若未來修改共用 Dialog 的定位方式，需同步重新驗證這組動畫。

### 4.3 無障礙與減少動態效果

當作業系統啟用 `prefers-reduced-motion: reduce` 時，月班表動畫時間會縮短為 1ms。

icon 與月份切換按鈕都有可辨識的 accessible name，關閉按鈕沿用共用 Dialog 的「關閉」名稱。

### 4.4 月曆日期計算

月班表固定建立 42 格，也就是 6 週 × 7 天。

`startOfWeek()` 以星期日為每週第一天：

```ts
const weekday = date.getDay()
date.setDate(date.getDate() - weekday)
```

例如 2026-09-01 是星期二，因此會出現在第三欄：

```text
週日 | 週一 | 週二 | 週三 | 週四 | 週五 | 週六
 30  |  31  |  1   |  2   |  3   |  4   |  5
```

週末樣式判斷必須是第一欄及最後一欄：

```ts
index % 7 === 0 || index % 7 === 6
```

不要改回 `index >= 5`；那是週一開頭時的六、日欄位算法。

### 4.5 資料查詢

Dialog 開啟時透過 `useSchedules` 查詢：

```text
version
employee
date_from
date_to
```

查詢日期會取「目前月份」與「版本有效期間」的交集，避免要求版本範圍外資料。

Dialog 關閉時不帶查詢參數，避免不必要的請求。

### 4.6 合規提醒來源

月班表接收排班頁目前的 `complianceResult?.violations`，再依以下條件篩選：

- 員工 ID。
- 當月日期範圍。
- 日期與班別模板。

同一格若同時存在 soft 與 hard violation，優先顯示 hard violation。

> 注意：若使用者尚未執行合規檢查，頁面沒有 `complianceResult`，月班表的提醒數可能顯示 0；這不代表後端永久沒有違規資料。

---

## 五、Excel 輸出實作

### 5.1 資料取得與模組載入

匯出時使用：

```ts
schedulesApi.listAll({
  version,
  date_from,
  date_to,
})
```

整合班表會同時使用：

```ts
employeesApi.listAll({
  is_active: true,
  organization,
  branch,
})
```

兩者都必須使用 `listAll`，不能只取得第一頁，否則員工或班次可能因 API 分頁而遺漏。個人版表不額外載入員工清單，以維持原有內容與分組行為；整合班表則會預先放入所有在職員工，即使整月沒有任何班次仍會顯示該員工欄位。

`scheduleExcelExport.ts` 使用 dynamic import 載入，避免 ExcelJS 增加排班頁初始 bundle 的負擔：

```ts
const { createScheduleWorkbook } = await import('@/lib/scheduleExcelExport')
```

### 5.2 個人版表的月份與週次切割

`buildMonthSections()` 會：

1. 走訪起訖日期包含的每個月份。
2. 找出該月第一個可見星期日。
3. 找出該月最後一個可見星期六。
4. 每 7 天建立一列。

個人版表與彈出月班表共用同一個星期概念：

```text
週日 → 週一 → 週二 → 週三 → 週四 → 週五 → 週六
```

不屬於該月份或不在匯出日期範圍內的格子會留白並使用灰色底。

### 5.3 個人版表

`layout === 'personal'` 時：

- 建立單一「個人版表」工作表。
- 員工依 `employee_id` 排序。
- 每位員工建立一個完整月曆區塊。
- 員工之間保留空白列。
- 員工區塊之間加入列印 page break。
- 內容沿用原本「整合班表」格式，不改變個人月曆資訊。

適合：

- 管理者一次查看。
- 交接。
- 整批列印。

### 5.4 整合班表

`layout === 'integrated'` 時：

- 建立單一「整合班表」工作表。
- A 欄為日期，B 欄為星期，C 欄起每位員工各占一欄。
- 所有在職員工依 `employee_id` 排序並持續向右延伸，不切成多個工作表。
- 每個月開始前插入月份分隔列。
- 未排班儲存格顯示「未排班」，不使用「休」，避免被解讀為已核准休假。
- 最下方顯示每位員工的排班天數與總工時。
- 末尾說明列明確註記未排班不等於核准休假。

適合：

- 管理者依日期比較全體人力配置。
- 參照紙本值勤表的「日期 × 員工」閱讀方式。
- 篩選、凍結窗格及橫向列印。

### 5.5 Excel 內容與樣式

個人版表的員工區塊包含：

- 員工編號。
- 姓名。
- 職稱。
- 排班天數。
- 預計工時。
- 月份標題。
- 星期標題。
- 日期、星期、班別及起訖時間。
- 未排班標記。

整合班表的設定：

- 前兩欄固定為日期與星期，員工欄固定寬度並可無上限向右延伸。
- 自動換行。
- 週日與週六使用週末色。
- 班別依模板 ID 配色。
- 橫向列印。
- 不強制將所有員工縮在單頁寬度，員工多時自然產生橫向列印分頁。
- 凍結第 3 列以上及 A、B 兩欄，捲動時保留員工表頭、日期與星期。
- 列印時重複第 3 列員工表頭及 A、B 兩欄。
- 列印順序為先向右、再向下。
- 隱藏工作表格線。
- Footer 顯示版本、日期範圍及頁碼。
- 日期以 `M/D` 顯示字串寫入，避免瀏覽器時區造成 Excel 日期退一天。

### 5.6 空資料行為

如果選擇的期間沒有任何排班：

- 個人版表仍會建立單一「個人版表」工作表，顯示「選擇的期間內沒有排班資料」。
- 整合班表仍會建立日期矩陣，所有在職員工欄位保留並顯示「未排班」。

### 5.7 員工與日期範圍

- 個人版表的員工群組仍由匯出期間內的 `schedules` 建立。
- 整合班表以選定版本的機構、分店與所有在職員工為基準。
- 若頁面分店選擇為「全部」，但版本本身限定分店，整合班表會沿用版本分店。
- 日期包含起始日與結束日，跨月時維持同一工作表並插入月份分隔列。

---

## 六、後端與資料模型影響

本次沒有新增後端 endpoint、model 或 migration；只在前端 employees API wrapper 新增分頁彙整方法。

沿用既有資料：

- 排班版本。
- 排班資料。
- 員工資料。
- 班別模板。
- 合規檢查結果。

前端依賴排班 API 支援以下 filter：

```text
version
employee
date_from
date_to
```

若後端修改欄位名稱、分頁格式或班別時間格式，需同步檢查：

- `useSchedules`
- `schedulesApi.listAll`
- `EmployeeMonthScheduleDialog`
- `scheduleExcelExport`

---

## 七、驗證紀錄

本次完成以下驗證：

- `npm run build` 通過。
- `git diff --check` 通過。
- 實際開啟 Alice Lin 個人月班表。
- 確認星期順序為週日到週六。
- 確認 2026-09-01（星期二）位於第三欄。
- 確認週日與週六套用週末樣式。
- 實測展開起點與 Alice Lin icon 中心一致。
- 實測關閉動畫沿原路回到 Alice Lin icon。
- 捲動頁面後測試 Brian Chen，動畫起點會依 Brian 的 icon 座標更新。
- 從頁面實際產生整合班表 `.xlsx`。
- 從頁面實際產生個人版表 `.xlsx`。
- 讀回兩個 workbook，確認：
  - 兩種格式都只有一張工作表。
  - 個人版表工作表名稱為「個人版表」。
  - 整合班表工作表名稱為「整合班表」。
  - 整合班表包含所有 6 位測試在職員工，含未排班員工。
  - 整合班表日期由 9/1 到 10/31，日期與星期一致。
  - 跨月月份分隔、排班天數及總工時正確。
  - 凍結位置為 `C4`，列印重複列為第 3 列、重複欄為 A:B。
  - 沒有 Excel 公式錯誤。
  - 星期標題為週日到週六。
  - 9/1 位於週二欄。
  - 週日及週六欄位套用週末配色。
- 使用本機 Excel 以唯讀方式輸出列印 PDF，再將所有頁面轉成 PNG 檢查：
  - 日期沒有時區退一天。
  - 各頁員工表頭完整。
  - 最後一頁統計與說明沒有裁切。

---

## 八、建議人工驗收流程

### 8.1 月班表

1. 啟動後端與前端。
2. 進入 `/schedules`。
3. 選擇有跨月份期間的排班版本。
4. 點擊第一位員工的月班表 icon。
5. 確認動畫從該 icon 展開。
6. 關閉並確認縮回同一位置。
7. 向下捲動後點擊另一位員工，確認動畫起點跟著改變。
8. 切換月份，確認不能超出版本有效期間。
9. 確認星期排列、班次時間、未排班及週末樣式。
10. 執行合規檢查後重新開啟月班表，確認提醒數及警示 icon。

### 8.2 Excel

1. 點擊「匯出」。
2. 選擇橫跨兩個月份的日期區間。
3. 分別匯出「個人版表」與「整合班表」。
4. 使用 Excel 開啟並確認：
   - 個人版表每週一列、週日位於第一欄。
   - 個人版表內容與既有版本一致。
   - 整合班表日期向下、員工向右。
   - 未排班員工仍有獨立欄位。
   - 跨月份分隔正確。
   - 員工資料與班次時間正確。
   - 兩種格式都只有一張工作表。
5. 開啟列印預覽，確認整合班表員工多時向右分頁，日期與星期欄及員工表頭會重複。

---

## 九、開發環境驗證指令

```bash
cd scheduling-frontend
npm run build
```

使用既有 Docker 後端時，可用以下方式啟動前端：

```powershell
docker run -d `
  --name scheduling-frontend `
  -p 3000:3000 `
  -e VITE_PROXY_TARGET=http://host.docker.internal:8000 `
  -v "${PWD}:/app" `
  -v scheduling_frontend_node_modules:/app/node_modules `
  -w /app `
  node:22-alpine `
  sh -c "npm ci --no-audit && npm run dev -- --host 0.0.0.0"
```

前端網址：

```text
http://localhost:3000/schedules
```

---

## 十、後續可擴充方向

- 將月班表中的班次改為可點擊，直接開啟排班編輯 Dialog。
- 提供「下載此員工班表」按鈕，直接從月班表匯出單人 Excel。
- 在月班表加入休假、請假與出勤狀態。
- 將合規違規詳情改成可讀文字，而非目前的 JSON tooltip。
- 加入 PDF 輸出或員工自助下載。
- 若員工數量很大，可考慮將 Excel 產生移至 Web Worker 或後端非同步工作。
- 視實際印表機紙張需求，提供 A3、A4 或每頁員工欄數的列印選項。
