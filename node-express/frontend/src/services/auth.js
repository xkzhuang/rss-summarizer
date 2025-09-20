import api from './api'

export const authService = {
  // Register new user
  async register(userData) {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  // Login user
  async login(credentials) {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  // Refresh token
  async refreshToken() {
    const response = await api.post('/auth/refresh-token')
    return response.data
  },

  // Logout user
  async logout() {
    const response = await api.post('/auth/logout')
    return response.data
  },

  // Get user profile
  async getProfile() {
    const response = await api.get('/auth/profile')
    return response.data
  },

  // Update user profile
  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData)
    return response.data
  },

  // Change password
  async changePassword(passwordData) {
    const response = await api.put('/auth/password', passwordData)
    return response.data
  },

  // Set OpenAI API key
  async setOpenAIKey(apiKey) {
    const response = await api.put('/auth/openai-key', { apiKey })
    return response.data
  },

  // Delete account
  async deleteAccount() {
    const response = await api.delete('/auth/account')
    return response.data
  }
}