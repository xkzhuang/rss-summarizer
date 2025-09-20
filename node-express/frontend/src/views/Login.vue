<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Or
          <router-link
            to="/register"
            class="font-medium text-primary-600 hover:text-primary-500"
          >
            create a new account
          </router-link>
        </p>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="identifier" class="sr-only">Email or Username</label>
            <input
              id="identifier"
              v-model="form.identifier"
              type="text"
              autocomplete="username"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': errors.identifier }"
              placeholder="Email or Username"
            />
            <p v-if="errors.identifier" class="mt-1 text-sm text-red-600">
              {{ errors.identifier }}
            </p>
          </div>
          <div>
            <label for="password" class="sr-only">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': errors.password }"
              placeholder="Password"
            />
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">
              {{ errors.password }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center flex-col">
            <div class="flex items-center">
              <input
                id="remember-me"
                v-model="form.rememberMe"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>
            <!-- Show indicator when credentials are loaded from storage -->
            <div 
              v-if="form.identifier && form.password && form.rememberMe" 
              class="mt-1 text-xs text-primary-600 flex items-center"
            >
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Credentials remembered
            </div>
          </div>

          <div class="text-sm">
            <a href="#" class="font-medium text-primary-600 hover:text-primary-500">
              Forgot your password?
            </a>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="spinner mr-2"></span>
            Sign in
          </button>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="rounded-md bg-red-50 p-4">
          <div class="text-sm text-red-800">
            {{ errorMessage }}
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const loading = ref(false)
const errorMessage = ref('')
const errors = reactive({})

const form = reactive({
  identifier: '',
  password: '',
  rememberMe: false,
})

// Load saved credentials on component mount
onMounted(() => {
  loadSavedCredentials()
})

// Watch for changes to rememberMe checkbox
watch(() => form.rememberMe, (newValue) => {
  if (!newValue) {
    // If "Remember me" is unchecked, clear saved credentials
    localStorage.removeItem('saved_login_credentials')
  }
})

const loadSavedCredentials = () => {
  try {
    const savedCredentials = localStorage.getItem('saved_login_credentials')
    if (savedCredentials) {
      const { identifier, password, rememberMe } = JSON.parse(savedCredentials)
      form.identifier = identifier || ''
      form.password = password || ''
      form.rememberMe = rememberMe || false
    }
  } catch (error) {
    console.error('Error loading saved credentials:', error)
    // Clear invalid saved data
    localStorage.removeItem('saved_login_credentials')
  }
}

const saveCredentials = () => {
  if (form.rememberMe) {
    // Save credentials to localStorage
    const credentialsToSave = {
      identifier: form.identifier,
      password: form.password,
      rememberMe: form.rememberMe
    }
    localStorage.setItem('saved_login_credentials', JSON.stringify(credentialsToSave))
  } else {
    // Clear saved credentials if "Remember me" is unchecked
    localStorage.removeItem('saved_login_credentials')
  }
}

const validateForm = () => {
  // Clear previous errors
  Object.keys(errors).forEach(key => delete errors[key])
  errorMessage.value = ''
  
  let isValid = true
  
  if (!form.identifier.trim()) {
    errors.identifier = 'Email or username is required'
    isValid = false
  }
  
  if (!form.password) {
    errors.password = 'Password is required'
    isValid = false
  } else if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
    isValid = false
  }
  
  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) return
  
  loading.value = true
  errorMessage.value = ''
  
  try {
    // Save credentials before attempting login
    saveCredentials()
    
    const response = await authStore.login({
      identifier: form.identifier,
      password: form.password,
      rememberMe: form.rememberMe,
    })
    
    if (response.success) {
      appStore.showSuccess('Welcome back!')
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('Login error:', error)
    
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'An error occurred during sign in. Please try again.'
    }
    
    // Handle validation errors
    if (error.response?.data?.errors) {
      Object.assign(errors, error.response.data.errors)
    }
    
    // If login failed, clear saved credentials to prevent saving wrong credentials
    if (form.rememberMe) {
      localStorage.removeItem('saved_login_credentials')
      form.rememberMe = false
    }
  } finally {
    loading.value = false
  }
}
</script>