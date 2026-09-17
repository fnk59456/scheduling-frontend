import axios from 'axios'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'
import { queryClient } from '@/api/queryClient'

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
  const state = useAuthStore.getState()

  if (state.authMethod === 'firebase' && auth?.currentUser) {
    setAuthHeader(config, `Bearer ${await auth.currentUser.getIdToken()}`)
    return config
  }

  if (state.devApiToken) {
    setAuthHeader(config, `Token ${state.devApiToken}`)
    return config
  }

  // Firebase redirect 返回後，store 可能尚未恢復；currentUser 仍可作為可靠來源。
  if (auth?.currentUser) {
    setAuthHeader(config, `Bearer ${await auth.currentUser.getIdToken()}`)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) return Promise.reject(error)

    const reqAuth =
      (typeof error.config?.headers?.get === 'function'
        ? error.config.headers.get('Authorization')
        : error.config?.headers?.Authorization) as string | undefined

    if (reqAuth?.startsWith('Bearer ') && auth?.currentUser && !error.config?._firebaseRetried) {
      try {
        error.config._firebaseRetried = true
        const newToken = await auth.currentUser.getIdToken(true)
        setAuthHeader(error.config, `Bearer ${newToken}`)
        return apiClient.request(error.config)
      } catch {
        queryClient.clear()
        useAuthStore.getState().logout()
      }
    }

    if (reqAuth?.startsWith('Token ')) {
      queryClient.clear()
      useAuthStore.getState().logout()
    }

    return Promise.reject(error)
  }
)

export default apiClient
