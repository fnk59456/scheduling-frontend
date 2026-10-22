import apiClient from '@/api/client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegistrationCodeRequest,
  RegistrationCodeResponse,
  UserProfile,
} from '@/types/auth'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login/', data).then((res) => res.data),

  sendRegistrationCode: (data: RegistrationCodeRequest) =>
    apiClient.post<RegistrationCodeResponse>('/auth/register/send-code/', data).then((res) => res.data),

  register: (data: RegisterRequest) =>
    apiClient.post<LoginResponse>('/auth/register/', data).then((res) => res.data),

  getMe: () =>
    apiClient.get<UserProfile>('/auth/users/me/').then((res) => res.data),

  updateProfile: (data: Partial<UserProfile>) =>
    apiClient.patch<UserProfile>('/auth/users/update_profile/', data).then((res) => res.data),
}
