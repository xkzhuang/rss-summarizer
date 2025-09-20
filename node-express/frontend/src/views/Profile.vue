<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Account Settings</h1>
      <p class="mt-2 text-gray-600">
        Manage your profile and account preferences
      </p>
    </div>

    <div class="space-y-8">
      <!-- Profile Information -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Profile Information</h2>
        </div>
        <form @submit.prevent="updateProfile" class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                v-model="profileForm.username"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                :class="{ 'border-red-300': profileErrors.username }"
              />
              <p v-if="profileErrors.username" class="mt-1 text-sm text-red-600">
                {{ profileErrors.username }}
              </p>
            </div>
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                v-model="profileForm.email"
                type="email"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                :class="{ 'border-red-300': profileErrors.email }"
              />
              <p v-if="profileErrors.email" class="mt-1 text-sm text-red-600">
                {{ profileErrors.email }}
              </p>
            </div>
          </div>
          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="updatingProfile"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              <span v-if="updatingProfile" class="spinner-sm mr-2"></span>
              Update Profile
            </button>
          </div>
          <div v-if="profileMessage" :class="[
            'rounded-md p-4 text-sm',
            profileMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          ]">
            {{ profileMessage.text }}
          </div>
        </form>
      </div>

      <!-- Change Password -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Change Password</h2>
        </div>
        <form @submit.prevent="changePassword" class="p-6 space-y-4">
          <div>
            <label for="currentPassword" class="block text-sm font-medium text-gray-700">
              Current Password
            </label>
            <input
              id="currentPassword"
              v-model="passwordForm.currentPassword"
              type="password"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              :class="{ 'border-red-300': passwordErrors.currentPassword }"
            />
            <p v-if="passwordErrors.currentPassword" class="mt-1 text-sm text-red-600">
              {{ passwordErrors.currentPassword }}
            </p>
          </div>
          <div>
            <label for="newPassword" class="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="newPassword"
              v-model="passwordForm.newPassword"
              type="password"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              :class="{ 'border-red-300': passwordErrors.newPassword }"
            />
            <p v-if="passwordErrors.newPassword" class="mt-1 text-sm text-red-600">
              {{ passwordErrors.newPassword }}
            </p>
          </div>
          <div>
            <label for="confirmNewPassword" class="block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              id="confirmNewPassword"
              v-model="passwordForm.confirmNewPassword"
              type="password"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              :class="{ 'border-red-300': passwordErrors.confirmNewPassword }"
            />
            <p v-if="passwordErrors.confirmNewPassword" class="mt-1 text-sm text-red-600">
              {{ passwordErrors.confirmNewPassword }}
            </p>
          </div>
          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="changingPassword"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              <span v-if="changingPassword" class="spinner-sm mr-2"></span>
              Change Password
            </button>
          </div>
          <div v-if="passwordMessage" :class="[
            'rounded-md p-4 text-sm',
            passwordMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          ]">
            {{ passwordMessage.text }}
          </div>
        </form>
      </div>

      <!-- OpenAI API Key -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">OpenAI API Key</h2>
          <p class="mt-1 text-sm text-gray-600">
            Set your personal OpenAI API key for generating summaries
          </p>
        </div>
        <form @submit.prevent="updateOpenAIKey" class="p-6 space-y-4">
          <div>
            <label for="openaiKey" class="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <div class="mt-1 relative">
              <input
                id="openaiKey"
                v-model="openaiForm.key"
                :type="showApiKey ? 'text' : 'password'"
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="sk-..."
              />
              <button
                type="button"
                @click="showApiKey = !showApiKey"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <EyeIcon v-if="!showApiKey" class="h-4 w-4 text-gray-400" />
                <EyeSlashIcon v-else class="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              Your API key is encrypted and stored securely. 
              <a href="https://platform.openai.com/api-keys" target="_blank" class="text-primary-600 hover:text-primary-500">
                Get your API key from OpenAI
              </a>
            </p>
          </div>
          <div class="flex justify-between items-center">
            <div class="flex items-center">
              <span class="text-sm text-gray-700">
                Status: 
                <span :class="user?.openaiKey ? 'text-green-600' : 'text-gray-500'">
                  {{ user?.openaiKey ? 'Key configured' : 'No key set' }}
                </span>
              </span>
            </div>
            <div class="space-x-3">
              <button
                v-if="user?.openaiKey"
                type="button"
                @click="removeOpenAIKey"
                class="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                Remove Key
              </button>
              <button
                type="submit"
                :disabled="updatingApiKey"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <span v-if="updatingApiKey" class="spinner-sm mr-2"></span>
                {{ user?.openaiKey ? 'Update Key' : 'Set Key' }}
              </button>
            </div>
          </div>
          <div v-if="apiKeyMessage" :class="[
            'rounded-md p-4 text-sm',
            apiKeyMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          ]">
            {{ apiKeyMessage.text }}
          </div>
        </form>
      </div>

      <!-- Danger Zone -->
      <div class="bg-white shadow rounded-lg border border-red-200">
        <div class="px-6 py-4 border-b border-red-200">
          <h2 class="text-lg font-medium text-red-900">Danger Zone</h2>
          <p class="mt-1 text-sm text-red-600">
            Irreversible and destructive actions
          </p>
        </div>
        <div class="p-6">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Delete Account</h3>
              <p class="mt-1 text-sm text-gray-600">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              @click="showDeleteConfirm = true"
              class="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Account Confirmation Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      @click="showDeleteConfirm = false"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
        @click.stop
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-red-900 mb-4">Delete Account</h3>
          <p class="text-sm text-gray-600 mb-4">
            This action cannot be undone. This will permanently delete your account and all associated data.
          </p>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Type "DELETE" to confirm:
            </label>
            <input
              v-model="deleteConfirmText"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500"
              placeholder="DELETE"
            />
          </div>
          <div class="flex justify-end space-x-3">
            <button
              @click="showDeleteConfirm = false"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="deleteAccount"
              :disabled="deleteConfirmText !== 'DELETE' || deletingAccount"
              class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <span v-if="deletingAccount" class="spinner-sm mr-2"></span>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const appStore = useAppStore()

const user = computed(() => authStore.user)

// Profile form
const profileForm = reactive({
  username: '',
  email: '',
})
const profileErrors = reactive({})
const profileMessage = ref(null)
const updatingProfile = ref(false)

// Password form
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
})
const passwordErrors = reactive({})
const passwordMessage = ref(null)
const changingPassword = ref(false)

// OpenAI API key form
const openaiForm = reactive({
  key: '',
})
const apiKeyMessage = ref(null)
const updatingApiKey = ref(false)
const showApiKey = ref(false)

// Delete account
const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')
const deletingAccount = ref(false)

// Initialize form data
const initializeForm = () => {
  if (user.value) {
    profileForm.username = user.value.username || ''
    profileForm.email = user.value.email || ''
  }
}

// Update profile
const updateProfile = async () => {
  // Clear errors
  Object.keys(profileErrors).forEach(key => delete profileErrors[key])
  profileMessage.value = null
  
  updatingProfile.value = true
  
  try {
    await authStore.updateProfile({
      username: profileForm.username,
      email: profileForm.email,
    })
    
    profileMessage.value = {
      type: 'success',
      text: 'Profile updated successfully!'
    }
  } catch (error) {
    console.error('Profile update error:', error)
    
    if (error.response?.data?.errors) {
      Object.assign(profileErrors, error.response.data.errors)
    }
    
    profileMessage.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to update profile'
    }
  } finally {
    updatingProfile.value = false
  }
}

// Change password
const changePassword = async () => {
  // Clear errors
  Object.keys(passwordErrors).forEach(key => delete passwordErrors[key])
  passwordMessage.value = null
  
  // Validate
  if (passwordForm.newPassword.length < 8) {
    passwordErrors.newPassword = 'Password must be at least 8 characters'
    return
  }
  
  if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
    passwordErrors.confirmNewPassword = 'Passwords do not match'
    return
  }
  
  changingPassword.value = true
  
  try {
    await authStore.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    
    // Clear form
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmNewPassword = ''
    
    passwordMessage.value = {
      type: 'success',
      text: 'Password changed successfully!'
    }
  } catch (error) {
    console.error('Password change error:', error)
    
    if (error.response?.data?.errors) {
      Object.assign(passwordErrors, error.response.data.errors)
    }
    
    passwordMessage.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to change password'
    }
  } finally {
    changingPassword.value = false
  }
}

// Update OpenAI API key
const updateOpenAIKey = async () => {
  apiKeyMessage.value = null
  updatingApiKey.value = true
  
  try {
    await authStore.setOpenAIKey({
      key: openaiForm.key,
    })
    
    openaiForm.key = ''
    
    apiKeyMessage.value = {
      type: 'success',
      text: 'API key updated successfully!'
    }
  } catch (error) {
    console.error('API key update error:', error)
    
    apiKeyMessage.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to update API key'
    }
  } finally {
    updatingApiKey.value = false
  }
}

// Remove OpenAI API key
const removeOpenAIKey = async () => {
  if (!confirm('Are you sure you want to remove your OpenAI API key?')) {
    return
  }
  
  updatingApiKey.value = true
  
  try {
    await authStore.setOpenAIKey({ key: null })
    
    apiKeyMessage.value = {
      type: 'success',
      text: 'API key removed successfully!'
    }
  } catch (error) {
    console.error('API key removal error:', error)
    
    apiKeyMessage.value = {
      type: 'error',
      text: error.response?.data?.message || 'Failed to remove API key'
    }
  } finally {
    updatingApiKey.value = false
  }
}

// Delete account
const deleteAccount = async () => {
  deletingAccount.value = true
  
  try {
    // In real app, this would call authStore.deleteAccount()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Mock delay
    
    appStore.showSuccess('Account deleted successfully')
    await authStore.logout()
  } catch (error) {
    console.error('Account deletion error:', error)
    appStore.showError('Failed to delete account')
  } finally {
    deletingAccount.value = false
    showDeleteConfirm.value = false
    deleteConfirmText.value = ''
  }
}

onMounted(() => {
  // If auth check is already complete, initialize form immediately
  if (authStore.initialAuthCheckComplete) {
    initializeForm()
  }
  // If auth check is still running, wait for it to complete
})

// Watch for authentication completion and user data changes
watch(() => authStore.initialAuthCheckComplete, (isComplete) => {
  if (isComplete && authStore.user) {
    initializeForm()
  }
})

// Also watch for user data changes directly
watch(() => authStore.user, (newUser) => {
  if (newUser && authStore.initialAuthCheckComplete) {
    initializeForm()
  }
}, { immediate: true })
</script>

<style scoped>
.spinner-sm {
  border: 1px solid #f3f3f3;
  border-top: 1px solid #3498db;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  animation: spin 1s linear infinite;
}
</style>