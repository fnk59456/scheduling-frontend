# 後端工程師交接文件：帳號角色與機構隔離

更新日期：2026-07-03

本文件說明本次前端配合後端 API 隔離邏輯所做的調整，以及後端工程師可用來驗證「不同角色」與「不同機構」資料隔離的本地 Docker 測試流程。

## 1. 改動內容

### 前端改動

- 換帳號時會清除 React Query 快取。
  - 登入成功後，先清掉上一個使用者留下的 API cache，再寫入新 token / user。
  - 登出時清掉所有已登入資料的 API cache。
  - Token 過期或後端回 `401` 時也會清掉 API cache。
  - 修正問題：從一個 manager 帳號登出後換另一個 manager，過去需要重新整理瀏覽器才會切換機構與排班資料。

- QueryClient 改為共用單例。
  - `src/api/queryClient.ts` 匯出共用的 `queryClient`。
  - `src/App.tsx` 改用共用 client，不再於 App 內 inline 建立。

- 改善 API 錯誤顯示。
  - `src/api/errors.ts` 會攤平 DRF 回傳的錯誤 payload。
  - 排班與員工的新增/更新失敗時，toast 會顯示後端欄位錯誤，例如跨機構員工或班別驗證錯誤。

- 調整排班頁機構選擇 UX。
  - 移除手動輸入 organization ID 的 fallback。
  - 機構選項一律來自 `useOrganizations()`。
  - 分店清單會依目前選定的機構過濾。

### 前端期待的後端行為

後端需要在下列排班相關端點強制套用 organization 資料隔離：

- `GET /api/schedules/versions/`
- `GET /api/schedules/schedules/`
- `GET /api/schedules/changes/`

預期行為：

- superuser 可以看到所有機構的資料。
- 非 superuser 使用者只能看到自己 `user.organization` 底下的資料。
- 非 superuser 即使手動帶入其他機構的 `?organization=<id>`，也不能擴大資料存取範圍，應回空結果或只保留自己機構的資料。

前端目前依賴的 serializer 相容性：

- `POST/PATCH /api/schedules/schedules/` 可接受 `employee` 與 `shift_template` 的整數 ID。
- 排班 response 仍需回傳 nested `employee` 與 `shift_template` 物件。
- `POST/PATCH /api/employees/employees/` 可接受 nested `user` 資料，或用 `user_id` 綁定既有 user。

## 2. 本地 Docker 啟動方式

在後端 repo 執行：

```powershell
cd "C:\Users\Frank hsu\Desktop\AI scheduling\scheduling-api"
docker compose up -d db redis web celery
docker compose exec web python manage.py migrate --noinput
```

常用檢查：

```powershell
docker compose ps
docker compose logs -f web
```

後端網址：

- API base：`http://localhost:8000/api`
- Swagger：`http://localhost:8000/api/docs/`
- Schema：`http://localhost:8000/api/schema/`

## 3. 產生測試資料

### 產生 CARE01 角色帳號

以下命令會建立 `CARE01` / `幸福長照機構`，並產生 manager、supervisor、employee 測試帳號：

```powershell
docker compose exec web python manage.py seed_data
```

請不要加 `--clear`，除非你確定要清掉目前本機 demo 資料。

### 產生 DEMO 機構資料

如果本機缺少 `DEMO` / `Demo Care Center` 資料，可執行：

```powershell
docker compose exec web python manage.py seed_demo_roster
```

### 補上 DEMO Manager / Supervisor 帳號

`seed_demo_roster` 會建立 DEMO 員工帳號與 admin，但不會建立 DEMO 的 manager / supervisor。請用下列命令補上：

```powershell
docker compose exec web python manage.py shell -c "from django.contrib.auth import get_user_model; from apps.accounts.models import Role; from apps.organizations.models import Organization, Branch; User=get_user_model(); demo=Organization.objects.get(code='DEMO'); branch=Branch.objects.filter(organization=demo).order_by('id').first(); manager_role=Role.objects.get(name='manager'); supervisor_role=Role.objects.get(name='supervisor'); specs=[('demo_manager','demo_manager123',manager_role),('demo_supervisor','demo_super123',supervisor_role)];
for username,password,role in specs:
    user,_=User.objects.update_or_create(username=username, defaults={'email': f'{username}@example.local', 'first_name': username.split('_')[1].title(), 'last_name': 'Demo', 'role': role, 'organization': demo, 'branch': branch, 'is_active': True})
    user.set_password(password); user.save(); print(username, '/', password, 'role=', role.name, 'org=', demo.code)"
```

## 4. 測試帳號

| 帳號 | 密碼 | 角色 | 機構 |
|---|---|---|---|
| `admin` | `admin123` | superuser / admin | 全部機構 |
| `demo_manager` | `demo_manager123` | manager | DEMO / Demo Care Center |
| `demo_supervisor` | `demo_super123` | supervisor | DEMO / Demo Care Center |
| `demo_e0001` | `emp123` | employee | DEMO / Demo Care Center |
| `manager` | `manager123` | manager | CARE01 / 幸福長照機構 |
| `supervisor` | `super123` | supervisor | CARE01 / 幸福長照機構 |
| `emp01` | `emp123` | employee | CARE01 / 幸福長照機構 |

## 5. 前端啟動方式

在前端 repo 執行：

```powershell
cd "C:\Users\Frank hsu\Desktop\AI scheduling\scheduling-frontend"
npm.cmd run dev
```

本地 `.env.local` 建議：

```env
VITE_API_BASE_URL=/api
VITE_AUTH_MODE=token
```

前端網址：

```text
http://localhost:3000
```

## 6. 手動測試步驟

### 測試機構隔離

1. 使用 `demo_manager / demo_manager123` 登入。
2. 進入排班管理頁。
3. 確認目前機構是 `Demo Care Center`。
4. 確認只看得到 DEMO 的排班版本與排班資料。
5. 登出。
6. 使用 `manager / manager123` 登入。
7. 確認目前機構切換為 `幸福長照機構`。
8. 確認只看得到 CARE01 的排班版本與排班資料。
9. 再切回 `demo_manager`。
10. 確認不需要重新整理瀏覽器，畫面資料就會切回 DEMO。

### 測試 Admin 跨機構可見性

1. 使用 `admin / admin123` 登入。
2. 進入排班管理頁。
3. 確認 admin 可以看到或切換兩個機構。
4. 確認 DEMO 與 CARE01 的排班版本都可存取。

### 測試角色權限

1. 使用 `manager / manager123` 登入。
2. 確認排班與員工管理頁可正常使用。
3. 使用 `supervisor / super123` 登入。
4. 依照後端權限設計，確認排班管理可正常使用。
5. 使用 `emp01 / emp123` 登入。
6. 確認受限頁面會顯示無權限，或無法進入。

### 測試換帳號快取問題

1. 使用 `demo_manager` 登入。
2. 開啟排班頁，記下目前機構。
3. 登出。
4. 使用 `manager` 登入。
5. 不要重新整理瀏覽器。
6. 確認機構、分店、員工、排班版本、排班資料都已切換為 CARE01。

## 7. 自動化檢查

前端：

```powershell
cd "C:\Users\Frank hsu\Desktop\AI scheduling\scheduling-frontend"
npm.cmd run build
```

後端目標測試：

```powershell
cd "C:\Users\Frank hsu\Desktop\AI scheduling\scheduling-api"
docker compose run --rm web pytest tests/test_production_settings.py tests/test_advanced.py tests/test_api.py
docker compose down
```

本次交接時的後端測試結果：

```text
104 passed
```

## 8. 注意事項

- 前端不應依賴 client-side `organization` query param 做安全控管，真正安全邊界必須在後端 queryset 隔離。
- 前端仍可傳 `organization` 作為檢視或篩選用途，特別是 superuser 跨機構管理流程。
- 若換帳號後畫面看起來仍殘留上一個帳號資料，請優先檢查登入、登出、token invalidation 時是否有清除 React Query cache。
