<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <Navigation v-if="!isAuthPage" />
    
    <!-- Main Content -->
    <main :class="{ 'pt-16': !isAuthPage }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Global Loading -->
    <div
      v-if="isGlobalLoading"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
        <div class="spinner"></div>
        <span class="text-gray-700">Loading...</span>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div
      v-if="notifications.length > 0"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 space-y-2"
    >
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'px-4 py-2 rounded-md shadow-lg text-sm transition-all duration-300',
          notification.type === 'success' ? 'bg-green-500 text-white' : 
          notification.type === 'error' ? 'bg-red-500 text-white' : 
          notification.type === 'warning' ? 'bg-yellow-500 text-white' :
          'bg-blue-500 text-white'
        ]"
      >
        {{ notification.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import Navigation from '@/components/Navigation.vue'

const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

// Check if user is authenticated on app load
onMounted(async () => {
  await authStore.checkAuth()
})

const isAuthPage = computed(() => 
  ['Login', 'Register'].includes(route.name)
)

const isGlobalLoading = computed(() => appStore.isLoading)
const notifications = computed(() => appStore.notifications)
</script>