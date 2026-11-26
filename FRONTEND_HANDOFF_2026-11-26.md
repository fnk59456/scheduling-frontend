# 前端交接（2026-11-26）— 合規提醒、拖曳複製與員工欄位修正

## 交付狀態

- 功能 commit：`41a200e`（`feat(schedules): add compliance triage and drag copy mode`）
- GitHub：已推送至 `fnk59456/scheduling-frontend` 的 `main`
- Firebase Hosting：已部署完成
- 正式站：<https://intelligent-scheduling-system.web.app>
- 線上 bundle：`/assets/index-DDFQ4YSO.js`
- 後端 API：沿用現有 API，這次沒有要求新的 endpoint 或 response shape

## 本次完成項目

### 1. 員工自然排序

- `ApprovalScheduleSummaryPage.tsx` 的簽核班表總表改用：
  `localeCompare(other, 'zh-TW', { numeric: true })`。
- 員工編號會依 `1, 2, 3 ... 10, 11` 排序，不再出現 `1, 10, 11, 2`。

### 2. 到職日欄位

- 只有合理的民國年 `1–150` 才自動加 1911；`151–1910` 交給原生 `min`／`max` 與後端驗證。
- 提示區預留固定高度，離開日期欄位後顯示換算文字時不會把建立／儲存按鈕往下推。
- 手機標籤縮短為「到職日（西元年）」，說明移到輸入框下方。
- 390px 寬度實測，週工時與到職日輸入框同高、同列。
- 原生 date input 無法輸入部分民國閏年（例如 `113/02/29`）仍屬已知限制；輸入西元 `2024/02/29` 可正常使用。

### 3. 排班拖曳「移動／複製」模式

- 草稿版本的週班表表頭新增「移動／複製」切換，預設為移動。
- 移動模式：`PATCH` 原班次，原位置消失。
- 複製模式：`POST` 新班次，原班次保留；狀態固定為 `assigned`，不複製備註。
- 兩種模式共用原本的同格、重複班別、國定假日、請假與跨版本重疊檢查。
- 複製模式使用 `effectAllowed/dropEffect = copy`，拖曳來源顯示「＋複製」，來源卡不淡出。
- 切換模式時會顯示操作說明 toast。

### 4. 「違規提醒」分類聚合

- 合規結果面板新增：
  - 人力不足、合規違規、注意提醒三個摘要數字。
  - 依數量顯示的問題類型分布色條。
  - 全部／違規／提醒／人力分頁。
  - 依 `(rule, severity)` 聚合的分類清單，一次展開一個分類。
  - 每類最多顯示 30 筆，提供固定說明與智慧修正方向。
  - 點問題可跳到所在週次並切換班表篩選。
- 合規規則的名稱、說明、建議與 detail 數字格式集中在
  `src/lib/scheduleCompliance.ts`。
- 同一班次的多筆違規改以陣列保存，不會再被後一筆覆蓋。
- 後端合規結果與前端即時工時警示若是同一問題會去重，避免徽章與診斷重複計數。

### 5. 直接在班表處理問題

- 週班表新增「全部班次／僅看違規 N／僅看提醒 N」。
- 未符合目前篩選的班次透明度降低，仍保留位置供比對。
- 班次卡右上角顯示 `!N`；硬性違規為紅色，只有提醒則為琥珀色。
- 問題來源包含：後端合規違規／提醒、單日工時、同日重疊、跨版本重疊、請假日排班、未開班。
- 點班次後的編輯對話框新增「班次合規診斷」，顯示：
  - 違規／提醒數量。
  - 問題標題與內容。
  - 關聯日期跳轉。
  - 建議處理方式。

## Smoke test

新增：

```bash
npm run smoke
```

此指令會先執行 `scripts/smoke-frontend.mjs`，再執行完整 `npm run build`。

2026-11-26 結果：

- 13/13 項功能 smoke checks 通過。
- TypeScript `tsc` 通過。
- Vite production build 通過，共轉換 2056 個 modules。
- `git diff --check` 通過。
- 仍有既有的 bundle 大於 500 kB 警告；不影響建置或本次部署。

## 畫面與 API 測試

測試環境：本機 Django API、Vite dev server、Chromium。

- 使用 `admin / admin123` 種子帳號登入。
- `1280 × 900` 桌機：頁面無 body-level 水平溢位；拖曳模式與問題篩選同時可見。
- `390 × 844` 手機：頁面無 body-level 水平溢位；週班表在表格容器內橫向滑動。
- 手機新增員工表單：到職日與週工時輸入框對齊，提示區高度固定。
- 合規檢查實測：摘要、類型分布、分類展開、問題明細與跳到班表均可操作。
- 班次編輯實測：顯示「班次合規診斷」、違規／提醒數與處理建議。
- 複製模式切換實測：顯示「已切換為複製模式」及操作說明。
- 瀏覽器 console：沒有 error 或 warning。
- 為避免修改共用種子班表，畫面測試未實際執行拖曳寫入；移動／複製 API 分流由 smoke check 與 TypeScript build 驗證。

## 正式部署驗證

- `firebase deploy --only hosting --project intelligent-scheduling-system` 成功。
- 正式站首頁：HTTP 200。
- 正式 JS bundle：HTTP 200，長度 959,062 bytes。
- 線上 bundle 已確認包含：
  - `已切換為複製模式`
  - `班次合規診斷`
  - `在班表上查看`

## 後續建議

1. PM 使用正式資料實際拖曳一筆班次，分別驗收移動與複製後的筆數變化。
2. 使用有多種違規的大型班表驗收分類數量與每週篩選。
3. 後續可將 ExcelJS 與其他大型依賴進一步 code split，降低主 bundle 大小警告。

## 工作樹注意事項

本次提交刻意沒有包含接手前就存在的變更：

- `.firebase/hosting.ZGlzdA.cache` 修改。
- `BACKEND_HANDOFF_2026-09-03.md` 刪除。
- 未追蹤的 `CLAUDE.md`。

處理或提交上述檔案前，請先確認它們的原始用途與擁有者。
