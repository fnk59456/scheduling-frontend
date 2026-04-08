import axios from 'axios'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'

type AuthMode = 'firebase' | 'token'

const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE as AuthMode | undefined) || 'firebase'

function setAuthHeader(config: any, value: string) {
  // Axios v1 may use AxiosHeaders which exposes .set()
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set('Authorization', value)
    return
  }
  config.headers = { ...(config.headers || {}), Authorization: value }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  if (AUTH_MODE === 'token') {
    const token = useAuthStore.getState().devApiToken
    if (token) setAuthHeader(config, `Token ${token}`)
    return config
  }

  // firebase mode
  if (!auth) return config
  const user = auth.currentUser
  if (user) setAuthHeader(config, `Bearer ${await user.getIdToken()}`)
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (AUTH_MODE === 'token') {
      // 只有在「確實帶了 Token」的請求被 401 時才清掉 token
      // 避免在登入前或初始化時（未附 Authorization）遇到 401 就把 token 清空，造成死循環
      if (error.response?.status === 401) {
        const reqAuth =
          (typeof error.config?.headers?.get === 'function'
            ? error.config.headers.get('Authorization')
            : error.config?.headers?.Authorization) as string | undefined

        if (reqAuth?.startsWith('Token ')) useAuthStore.getState().setDevApiToken(null)
      }
      return Promise.reject(error)
    }

    if (!auth) return Promise.reject(error)
    if (error.response?.status === 401) {
      const user = auth.currentUser
      if (user) {
        const newToken = await user.getIdToken(true)
        setAuthHeader(error.config, `Bearer ${newToken}`)
        return apiClient.request(error.config)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
