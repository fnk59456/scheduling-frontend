# 本地部署測試手順

本文件提供新工程師從 GitHub 乾淨 clone 前後端後，在本機部署測試的完整流程。

適用情境：

- 後端：Docker Compose
- 前端：`npm run dev`
- 本地登入：Token auth
- 本地測試帳號：`admin / admin123`

## 1. Clone 專案

```powershell
git clone https://github.com/sam9407287/scheduling-api.git
git clone https://github.com/fnk59456/scheduling-frontend.git
```

目前需注意：如果 GitHub 尚未合併本機修正，單純設定環境變數仍不夠，必須先套用必要程式碼修正。

## 2. 先確認必要修正是否已存在

### 後端必要修正

確認以下檔案是否已包含修正：

```text
scheduling-api/config/settings/development.py
scheduling-api/apps/audit/signals.py
scheduling-api/apps/schedules/serializers.py
scheduling-api/apps/employees/serializers.py
scheduling-api/apps/accounts/management/commands/seed_demo_roster.py
```

必要內容：

- `development.py`
  - 加入 `rest_framework.authtoken`
  - local dev 使用 `TokenAuthentication`
- `audit/signals.py`
  - audit skip labels 加入 `authtoken`
- `schedules/serializers.py`
  - `ScheduleSerializer.employee` / `shift_template` 可接受 ID 寫入
  - 回傳時仍輸出 nested `employee` / `shift_template`
- `employees/serializers.py`
  - `EmployeeListSerializer` 回傳 `user`、`organization`、`branch`
  - `EmployeeSerializer` 支援 nested `user` create/update
- `seed_demo_roster.py`
  - 建立 demo 組織、分店、員工、班別、班表、`admin/admin123`

### 前端建議修正

確認以下檔案是否已包含修正：

```text
scheduling-frontend/src/pages/employees/EmployeeDetailPage.tsx
scheduling-frontend/src/pages/employees/EmployeeFormDialog.tsx
scheduling-frontend/src/types/employee.ts
scheduling-frontend/vite.config.ts
```

必要內容：

- 員工明細「編輯」按鈕可開表單
- 員工表單支援新增/編輯模式
- 編輯時送 `PATCH`
- `EmployeeUpdateRequest` 支援 `user`
- `vite.config.ts` 可支援 `VITE_PROXY_TARGET`
  - 此項偏部署彈性，若固定用 `npm run dev`，不是必需

如果上述修正尚未 merge 到 GitHub，請先切到包含修正的 branch，或先套用 patch，再繼續部署。

## 3. 後端環境設定

進入後端：

```powershell
cd scheduling-api
```

建立 `.env`：

```env
SECRET_KEY=dev-local-secret-key-change-before-production
DEBUG=1
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
DJANGO_SETTINGS_MODULE=config.settings.development

DB_NAME=scheduling_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@db:5432/scheduling_db

REDIS_URL=redis://redis:6379/0
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173

FIREBASE_CREDENTIALS_PATH=
AI_SCHEDULE_PROVIDER=apps.ai_engine.providers.ortools_provider.ORToolsProvider
```

啟動後端服務：

```powershell
docker compose up -d --build
docker compose exec web python manage.py migrate
docker compose exec web python manage.py check
```

建立 demo 資料：

```powershell
docker compose exec web python manage.py seed_demo_roster --reset
```

成功後應可使用：

```text
admin / admin123
```

## 4. 前端環境設定

另開 PowerShell：

```powershell
cd scheduling-frontend
npm ci
```

建立 `.env.local`：

```env
VITE_API_BASE_URL=/api
VITE_AUTH_MODE=token
VITE_BYPASS_AUTH=false
```

啟動前端：

```powershell
npm run dev
```

打開：

```text
http://localhost:3000
```

## 5. 驗收流程

依序測試：

```text
1. 使用 admin / admin123 登入
2. 員工列表可正常載入
3. 新增員工成功
4. 進員工明細頁，點編輯可開表單並儲存
5. 設為離職 / 設為在職可切換
6. 班表頁可看到 demo 初始班表
7. 新增排班成功
8. 刪除排班成功
9. 瀏覽器 Console 不應再有新的 401 / 500
```

可補跑：

```powershell
# backend
docker compose exec web python manage.py check

# frontend
npm run build
```

## 6. 常見地雷

- 前端 `.env.example` 預設可能是 `firebase`，本地測試要用 `VITE_AUTH_MODE=token`。
- Docker 內後端連 DB 要用 `DB_HOST=db`，不是 `localhost`。
- 沒有 `rest_framework.authtoken`，local token login 會壞。
- audit 沒跳過 `authtoken`，登入建立 token 可能 500。
- `ScheduleSerializer` 若仍是 nested read-only，新增排班會 `employee_id null` 500。
- `EmployeeSerializer` 若沒處理 nested `user`，新增員工會 `user_id null` 500。
- 沒有 seed demo 資料時，登入後可能沒有組織、員工、班別、班表可測。
- `.env`、`.env.local` 不要提交真實密鑰。
- `node_modules`、`dist`、`.npm-cache` 不要提交。

## 7. 完成標準

新工程師本地部署完成的標準是：

```text
後端 Docker web/db/redis/celery 正常 running
http://localhost:8000 可用
http://localhost:3000 可用
admin/admin123 可登入
員工新增/編輯可用
班表載入/新增/刪除可用
npm run build 通過
python manage.py check 通過
```


