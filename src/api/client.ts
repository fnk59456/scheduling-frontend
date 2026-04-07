import axios from 'axios'
import { auth } from '@/lib/firebase'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const user = auth.currentUser
      if (user) {
        const newToken = await user.getIdToken(true)
        error.config.headers.Authorization = `Bearer ${newToken}`
        return apiClient.request(error.config)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
