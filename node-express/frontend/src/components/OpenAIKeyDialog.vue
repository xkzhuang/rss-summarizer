<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            OpenAI API Key Required
          </h3>
          <button
            v-if="!isRequired"
            @click="close"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="mb-4">
          <p class="text-sm text-gray-600 mb-3">
            To generate article summaries using AI, you need to provide your OpenAI API key. 
            Your key will be encrypted and stored securely.
          </p>
          <p class="text-xs text-gray-500 mb-4">
            You can get your API key from 
            <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
              OpenAI's platform
            </a>
          </p>
        </div>

        <form @submit.prevent="saveApiKey" class="space-y-4">
          <div>
            <label for="apiKey" class="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              id="apiKey"
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': error }"
              required
            />
            <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
          </div>

          <div class="flex items-center justify-between space-x-3">
            <button
              v-if="!isRequired"
              type="button"
              @click="close"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isLoading || !apiKey.trim()"
              class="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="isLoading" class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
              <span v-else>Save API Key</span>
            </button>
          </div>
        </form>

        <div class="mt-4 p-3 bg-blue-50 rounded-md">
          <div class="flex">
            <svg class="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <div class="text-sm text-blue-700">
              <p class="font-medium">Why do I need this?</p>
              <p class="mt-1">Your API key allows the app to generate article summaries using OpenAI's services. We encrypt and store it securely for your convenience.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { authService } from '../services/auth.js'

export default {
  name: 'OpenAIKeyDialog',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    isRequired: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const apiKey = ref('')
    const isLoading = ref(false)
    const error = ref('')

    const close = () => {
      if (!props.isRequired) {
        resetForm()
        emit('close')
      }
    }

    const resetForm = () => {
      apiKey.value = ''
      error.value = ''
      isLoading.value = false
    }

    const validateApiKey = (key) => {
      if (!key.trim()) {
        return 'API key is required'
      }
      if (!key.startsWith('sk-')) {
        return 'Invalid API key format. OpenAI keys start with "sk-"'
      }
      if (key.length < 20) {
        return 'API key appears to be too short'
      }
      return null
    }

    const saveApiKey = async () => {
      error.value = ''
      
      const validationError = validateApiKey(apiKey.value)
      if (validationError) {
        error.value = validationError
        return
      }

      isLoading.value = true

      try {
        await authService.setOpenAIKey(apiKey.value.trim())
        
        // Clear the key from memory for security
        apiKey.value = ''
        
        emit('saved')
        
        if (!props.isRequired) {
          emit('close')
        }
      } catch (err) {
        error.value = err.message || 'Failed to save API key'
      } finally {
        isLoading.value = false
      }
    }

    return {
      apiKey,
      isLoading,
      error,
      close,
      saveApiKey
    }
  }
}
</script>