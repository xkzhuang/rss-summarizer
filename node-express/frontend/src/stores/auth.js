import { defineStore } from 'pinia'
import { authService } from '@/services/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    initialAuthCheckComplete: false,
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    userInitials: (state) => {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] Computing userInitials for user:`, state.user)
      console.log(`[${timestamp}] isAuthenticated:`, state.isAuthenticated)
      console.log(`[${timestamp}] token exists:`, !!state.token)
      console.log(`[${timestamp}] User object type:`, typeof state.user)
      console.log(`[${timestamp}] User username:`, state.user?.username)
      console.log(`[${timestamp}] User keys:`, state.user ? Object.keys(state.user) : 'null')
      
      if (!state.user?.username) {
        console.log(`[${timestamp}] No username found, returning fallback "U"`)
        return 'U'
      }
      const initials = state.user.username.substring(0, 2).toUpperCase()
      console.log(`[${timestamp}] Generated initials:`, initials)
      return initials
    },
  },

  actions: {
    // Initialize authentication state
    async checkAuth() {
      console.log('Running checkAuth...')
      
      // Check both localStorage and sessionStorage for token
      let token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      let userData = localStorage.getItem('user_data') || sessionStorage.getItem('user_data')
      
      console.log('Found token:', !!token)
      console.log('Found userData:', !!userData)
      
      if (token && userData) {
        try {
          // Parse user data and set state immediately
          const parsedUserData = JSON.parse(userData)
          console.log('Parsed user data:', parsedUserData)
          
          // Ensure the parsed user data has the expected structure
          if (parsedUserData && typeof parsedUserData === 'object' && parsedUserData.username) {
            this.token = token
            this.user = { ...parsedUserData } // Use spread operator to ensure reactivity
            this.isAuthenticated = true
            
            console.log('Auth state set, user:', this.user)
            console.log('User username after setting:', this.user.username)
            
            // Skip getProfile() call during initial auth check to avoid race conditions
            // Token verification can happen later when user actually makes API calls
          } else {
            console.error('Invalid user data structure:', parsedUserData)
            this.logout()
          }
        } catch (error) {
          console.error('Error parsing stored user data or verifying token:', error)
          this.logout()
        }
      } else {
        // No stored auth data
        console.log('No stored auth data found')
        this.token = null
        this.user = null
        this.isAuthenticated = false
      }
      
      // Mark initial auth check as complete
      this.initialAuthCheckComplete = true
      console.log('Initial auth check complete')
    },

    // Login user
    async login(credentials) {
      this.loading = true
      try {
        const response = await authService.login(credentials)
        
        if (response.success) {
          this.token = response.data.token
          this.user = response.data.user
          this.isAuthenticated = true
          
          // Store based on remember me preference
          if (credentials.rememberMe) {
            // Use localStorage for persistent storage (remember me)
            localStorage.setItem('auth_token', response.data.token)
            localStorage.setItem('user_data', JSON.stringify(response.data.user))
          } else {
            // Use sessionStorage for session-only storage
            sessionStorage.setItem('auth_token', response.data.token)
            sessionStorage.setItem('user_data', JSON.stringify(response.data.user))
          }
          
          return response
        }
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Register user
    async register(userData) {
      this.loading = true
      try {
        const response = await authService.register(userData)
        
        if (response.success) {
          this.token = response.data.token
          this.user = response.data.user
          this.isAuthenticated = true
          
          // Store in sessionStorage by default for registration (user can login with "remember me" later)
          sessionStorage.setItem('auth_token', response.data.token)
          sessionStorage.setItem('user_data', JSON.stringify(response.data.user))
          
          return response
        }
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Logout user
    async logout() {
      try {
        await authService.logout()
      } catch (error) {
        // Continue with logout even if API call fails
        console.error('Logout error:', error)
      }
      
      // Clear state
      this.user = null
      this.token = null
      this.isAuthenticated = false
      this.initialAuthCheckComplete = false
      
      // Clear authentication tokens from both storage types
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      sessionStorage.removeItem('auth_token')
      sessionStorage.removeItem('user_data')
      
      // Note: We preserve 'saved_login_credentials' so the login form can be prepopulated
      // This will be cleared only if the user unchecks "Remember me" on the login form
      
      // Redirect to login
      window.location.href = '/login'
    },

    // Get user profile
    async getProfile() {
      try {
        const response = await authService.getProfile()
        if (response.success) {
          this.user = response.data
          // Update user data in the appropriate storage
          if (localStorage.getItem('auth_token')) {
            localStorage.setItem('user_data', JSON.stringify(response.data))
          } else if (sessionStorage.getItem('auth_token')) {
            sessionStorage.setItem('user_data', JSON.stringify(response.data))
          }
        }
        return response
      } catch (error) {
        throw error
      }
    },

    // Update user profile
    async updateProfile(profileData) {
      this.loading = true
      try {
        const response = await authService.updateProfile(profileData)
        if (response.success) {
          this.user = { ...this.user, ...response.data }
          // Update user data in the appropriate storage
          if (localStorage.getItem('auth_token')) {
            localStorage.setItem('user_data', JSON.stringify(this.user))
          } else if (sessionStorage.getItem('auth_token')) {
            sessionStorage.setItem('user_data', JSON.stringify(this.user))
          }
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Change password
    async changePassword(passwordData) {
      this.loading = true
      try {
        const response = await authService.changePassword(passwordData)
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Set OpenAI API key
    async setOpenAIKey(keyData) {
      this.loading = true
      try {
        const response = await authService.setOpenAIKey(keyData)
        if (response.success) {
          // Update user data
          await this.getProfile()
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})