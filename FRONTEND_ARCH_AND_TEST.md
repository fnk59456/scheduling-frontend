# AI 智慧排班系統（前端）架構與測試流程

本文件說明目前已完成的 React 前端架構（第 1～2 週範圍）與建議的使用者測試流程，方便你與後端/QA 交接與驗收。

---

## 一、技術棧與核心約定

- **React + TypeScript + Vite**
- **Tailwind CSS（v4）**：以 **HSL CSS Variables** 建立 design tokens，並以 `.dark` class 切換暗色模式
- **Radix UI + shadcn/ui 風格元件**：`cva` + `cn()`（`clsx` + `tailwind-merge`）的樣式模式
- **React Router**：路由與巢狀路由（設定頁 Tabs）
- **TanStack React Query**：資料取得、快取、mutation 與失效刷新
- **Zustand**：登入使用者狀態（含簡單角色判斷）
- **Axios**：API client，透過攔截器自動帶入 Firebase Token，並處理 401 強制刷新
- **Firebase Auth**：登入來源；後端以 Firebase ID Token 驗證

路徑別名：
- `@/` → `src/`

---

## 二、目前前端資訊架構（IA）與路由

### 公開頁
- `/login`：登入頁（Email/Password）

### 需登入（ProtectedRoute）
主框架：`MainLayout`（TopNav + Sidebar + Content）

- `/dashboard`：營運總覽（已串接部分管理資料統計）
- `/employees`：員工列表（搜尋/篩選/新增）
- `/employees/:id`：員工詳情（契約/證照）

### 設定（Tabs + Outlet 巢狀路由）
- `/settings`：設定首頁（自動導向第一個 tab）
  - `/settings/organizations`：機構/分店管理
  - `/settings/shifts`：班別模板管理
  - `/settings/rules`：排班規則管理
  - `/settings/certifications`：證照類型管理

### 其他功能（目前為占位頁，等待後續週次）
- `/schedules`（第 3 週）
- `/attendance`（第 5 週）
- `/overtime`（第 9 週）
- `/compliance`（第 7 週）
- `/help`

---

## 三、目錄結構與模組責任（你可以從這裡快速定位）

```
src/
├── api/
│   ├── client.ts                 # Axios instance + Firebase token/401 refresh 攔截器
│   └── endpoints/                # 各 domain 的 API 封裝（auth/organizations/employees/shifts）
├── components/
│   ├── common/
│   │   └── DataTable.tsx         # 可複用表格（搜尋/排序/分頁/狀態）
│   ├── layout/
│   │   ├── MainLayout.tsx        # TopNav + Sidebar + Toaster + 內容容器
│   │   ├── Sidebar.tsx           # 左側導覽（分區、role gating）
│   │   └── TopNav.tsx            # 頂部導覽（搜尋、主題切換、使用者選單）
│   ├── providers/
│   │   └── ThemeProvider.tsx     # next-themes wrapper（避免 hydration 不一致）
│   ├── ui/                       # shadcn/ui 風格元件（Button/Card/Input/Select/...）
│   └── ProtectedRoute.tsx        # 登入守衛 + 403
├── hooks/
│   ├── useAuth.ts                # Firebase onAuthStateChanged + 取得 /auth/users/me/
│   ├── useEmployees.ts           # React Query（employees + certifications + contracts + cert ops）
│   ├── useOrganizations.ts       # React Query（organizations + branches）
│   ├── useShifts.ts              # React Query（shift templates + shift rules）
│   └── use-toast.ts              # Toast 狀態（Toaster）
├── lib/
│   ├── firebase.ts               # Firebase 初始化（讀取 VITE_FIREBASE_* env）
│   └── utils.ts                  # cn()
├── pages/
│   ├── employees/
│   │   ├── EmployeesPage.tsx
│   │   ├── EmployeeDetailPage.tsx
│   │   └── EmployeeFormDialog.tsx
│   ├── settings/
│   │   ├── SettingsPage.tsx      # Tabs + Outlet
│   │   ├── OrganizationsPage.tsx
│   │   ├── ShiftTemplatesPage.tsx
│   │   ├── ShiftRulesPage.tsx
│   │   └── CertificationsPage.tsx
│   ├── DashboardPage.tsx
│   ├── LoginPage.tsx
│   └── PlaceholderPage.tsx
├── stores/
│   └── authStore.ts              # user、isAuthenticated、hasRole（persist）
└── types/
    ├── api.ts                    # PaginatedResponse / ApiError
    ├── auth.ts
    ├── employee.ts
    ├── organization.ts
    └── shift.ts
```

---

## 四、資料流（重要：登入與 API 串接怎麼運作）

### 1) 登入與身分取得

1. 使用者在 `/login` 透過 **Firebase Auth** 登入（Email/Password）
2. `useAuth` 監聽 `onAuthStateChanged`
3. 一旦 Firebase 有 currentUser：
   - 由 `api/client.ts` 攔截器自動取得 `idToken` 並加到 header：
     - `Authorization: Bearer <firebase_id_token>`
   - 呼叫後端 `GET /api/auth/users/me/` 取得 `UserProfile`
4. `authStore` 保存 `user` 與 `isAuthenticated`

> 注意：若後端回 401，Axios response interceptor 會 `getIdToken(true)` 強制刷新後重送。

### 2) CRUD 與快取

- pages 使用 `useOrganizations/useEmployees/useShifts` 取得資料
- 新增/更新/刪除成功會：
  - `invalidateQueries()` 讓列表自動刷新
  - 以 toast 顯示結果

---

## 五、環境設定（測試前必做）

### 1) 前端環境變數

在前端專案根目錄建立 `.env`（可從 `.env.example` 複製）：

- `VITE_API_BASE_URL=/api`（預設即可；Vite dev server 會 proxy 到後端）
- `VITE_FIREBASE_*`：填入 Firebase 專案設定

### 2) 啟動後端

確保後端在本機可用：
- API base：`http://localhost:8000/api`
- OpenAPI/Swagger：`/api/docs/`

### 3) 啟動前端

在 `scheduling-frontend`：
- `npm install`
- `npm run dev`

預設：`http://localhost:3000/`

---

## 六、使用者測試流程（建議按順序走）

### A. 冒煙測試（5 分鐘）

1. 進入 `http://localhost:3000/`
2. 未登入時應被導到 `/login`
3. 輸入 Firebase 測試帳號登入
4. 登入成功後應進到 `/dashboard`
5. TopNav：
   - 可切換暗/亮模式
   - 右上角使用者下拉選單可按「登出」，登出後回到 `/login`

### B. 基礎管理功能測試（第 2 週重點）

#### 1) 組織與分店（`/settings/organizations`）

- **建立機構**
  - 點「新增機構」→ 填 name/code/email/phone/address → 建立
  - 檢查列表出現新機構，branch_count 正確
- **編輯機構**
  - 點鉛筆 → 修改資料 → 更新
- **刪除機構**
  - 點垃圾桶 → 刪除
  -（若後端有 FK/保護限制，可能會刪除失敗；此屬正常，需後端規則配合）

- **建立分店**
  - 可從機構卡片內「新增分店」或右上「新增分店」
  - 建立後應顯示在該機構下
- **編輯/刪除分店**

#### 2) 班別模板（`/settings/shifts`）

- 新增班別：name、organization、start/end、break/overlap、min_staff_count
- 編輯班別：確認卡片資訊更新
- 刪除班別：確認列表移除

#### 3) 排班規則（`/settings/rules`）

- 新增規則：
  - rule_type：例如 `max_weekly_hours`
  - value：可輸入 `40` 或 JSON（例如 `{"value":40,"unit":"hours"}`）
- 編輯/刪除規則：確認卡片刷新

#### 4) 證照類型（`/settings/certifications`）

- 新增證照類型（name/code/description）
- 刪除證照類型

#### 5) 員工管理（`/employees`）

- 先確保至少已有「機構/分店」
- **新增員工**
  - 點「新增員工」：建立 user + employee
  - 送出後列表應刷新
  - 點員工列可進入詳情頁

#### 6) 員工詳情（`/employees/:id`）

- **切換在職/離職**
  - 點「設為離職 / 設為在職」
- **新增契約**
  - 點「新增契約」→ 填 contract_type/start/end/base_salary/agreed_hours_per_week/notes
  - 送出後契約列表應更新
- **新增/移除證照**
  - 點「新增」→ 選擇證照類型 → 新增
  - 點垃圾桶 → 移除

---

## 七、常見問題排查（Root Cause 快速定位）

### 1) 登入後仍然 401/403

- **可能原因（401）**：Firebase env 未設定/錯誤、後端驗證 Firebase token 失敗
  - 檢查 `.env` 的 `VITE_FIREBASE_*`
  - 用後端 Swagger 測試 `GET /api/auth/users/me/` 是否可在帶 token 下成功
- **可能原因（403）**：後端權限控制（role）不足
  - 後端多數管理端點需 `manager/supervisor/admin`
  - 前端 Sidebar 的「系統設定」預設只對 `admin/manager` 顯示（`hasRole`）

### 2) 列表無資料但後端有資料

- 確認後端回應是否為 DRF 分頁格式：`{ count, next, previous, results }`
- 若後端某些端點未使用分頁，前端需要調整回應型別（可在對應 `api/endpoints/*` 修正）

### 3) 表單送出成功但列表未刷新

- 檢查 hook 是否有 `invalidateQueries` 對應正確 queryKey

---

## 八、建議你下一步（第 3 週）

- 排班版本（ScheduleVersion）與排班（Schedule）CRUD
- 排班 grid/週視圖 UI（依據 `schedule.md` 第 3 週目標）
- 基本違規偵測提示（先以後端回傳 violations 顯示）

