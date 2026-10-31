# 前端交接 2026-10-31：休息日、國定假日意願與期間排休

## 本次完成

- 員工詳情「可用性與偏好」新增排班意願：
  - `rest_day_work_ok`：是否同意人力不足時上每週第 6 天（休息日）。
  - `holiday_work`：`forbid` / `allow` / `prefer` / `avoid` 四種國定假日意願。
  - 與原可用性欄位一起寫入既有 availability API；時薪制顯示假日加倍計薪提示。
- 員工列表依 `scheduling_prefs` 顯示「可上第 6 天／假日不排／偏好假日／假日不優先」徽章。
- AI 排班區間變更時，自動呼叫免費的 `GET /api/ai/schedule/rest-quota/`：
  - 顯示期間天數、週休、國定假日、月薪制最多上班天數。
  - 可展開每人薪制、配額、休息日同意與假日意願。
- 班表國定假日欄：
  - `holiday_work=forbid` 的員工，拖放或手動建立都會在前端阻擋。
  - `holiday_work=prefer` 的空白假日格顯示「★ 偏好」。
  - `kind=makeup` 統一顯示「補假日」，不再誤寫為補班日。
- 合規提示：
  - `holiday_work_refused` 依 hard violation 顯示紅色。
  - `holiday_scheduling` 顯示員工假日意願與加倍工資／補休提示。
  - `weekly_rest_days` 依 `rest_day_work_ok` 區分「已同意／未同意」文案。
- LLM 排班 `rejected[].reason` 保持後端原文顯示，可直接看到假日、休息日與例假拒絕原因。

## API 契約

- `GET/PATCH /api/employees/employees/{id}/availability/`
- `GET /api/employees/employees/` 與 `/{id}/` 的 `scheduling_prefs`
- `GET /api/ai/schedule/rest-quota/?period_start=&period_end=&organization_id=&branch_id=`
- `POST /api/ai/schedule/llm-generate/` 的 `rejected[].reason`
- `POST /api/schedules/versions/{id}/check-compliance/` 的新規則與 `detail.holiday_work`

## 驗證

- `npm run build`：通過。
- 本地 Docker 後端 + 既有 `scheduling-frontend` 容器：
  - admin 登入成功。
  - 排班意願修改、儲存、重新整理後保留；測試結束已還原原資料。
  - 2026-10-01～2026-10-31 試算：31 天、週休 9 天、國定假日 4 天、月薪制最多上 18 天。
  - 國慶日與光復節補假均顯示「補假日」，每人配額表可正常展開。

## 暫不處理

- 員工列表的「假日意願」伺服器端篩選：目前後端列表 API 尚無對應 query parameter，避免前端只篩單頁造成誤解。
- `/generate/` 回傳的 `metadata.rest_quota` 結果面板：目前正式按鈕仍依既有產品流程使用 `/llm-generate/`，本次不切換引擎。

## 行動版第一階段修正

- 手機側邊選單改為 React state 控制，不再直接操作 DOM class。
- 修正 Sidebar 自身的 `hidden md:block` 導致手機抽屜整片空白。
- 點選導覽項目、切換路由或點擊遮罩時會自動關閉選單；開啟期間鎖定背景捲動。
- 手機選單按鈕補上 `aria-label` / `aria-expanded`。
- 加班紀錄標題、從出勤計算按鈕與月份改為手機上下排列。
- 共用資料表新增選用的手機橫向滑動提示及固定第一欄；員工列表已啟用。
- 週班表在手機顯示左右滑動／點擊指派提示，並固定員工欄。

驗證尺寸：Android 常見 viewport `390 × 844`。側欄開關、遮罩關閉、選單換頁、加班頁排列與班表固定欄均通過；未發現 JavaScript error。
