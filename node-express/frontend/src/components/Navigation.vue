<template>
  <nav class="bg-white shadow-sm border-b border-gray-200 fixed w-full top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <!-- Logo and main nav -->
        <div class="flex">
          <!-- Logo -->
          <div class="flex-shrink-0 flex items-center">
            <router-link to="/dashboard" class="text-xl font-bold text-primary-600">
              RSS Summarizer
            </router-link>
          </div>

          <!-- Desktop navigation -->
          <div class="hidden md:ml-6 md:flex md:space-x-8">
            <router-link
              v-for="item in navItems"
              :key="item.name"
              :to="item.to"
              :class="[
                'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                $route.name === item.name
                  ? 'border-primary-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <component :is="item.icon" class="w-4 h-4 mr-2" />
              {{ item.label }}
            </router-link>
          </div>
        </div>

        <!-- User menu -->
        <div class="flex items-center">
          <!-- Mobile menu button -->
          <button
            class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <Bars3Icon v-if="!mobileMenuOpen" class="h-6 w-6" />
            <XMarkIcon v-else class="h-6 w-6" />
          </button>

          <!-- Desktop user menu -->
          <div class="hidden md:ml-4 md:flex md:items-center md:space-x-4">
            <!-- Notifications (placeholder) -->
            <button class="p-2 rounded-full text-gray-400 hover:text-gray-500">
              <BellIcon class="h-5 w-5" />
            </button>

            <!-- User dropdown -->
            <div class="relative" ref="userDropdown">
              <!-- Loading state while auth check is running -->
              <div v-if="!authStore.initialAuthCheckComplete" class="h-8 w-8 rounded-full bg-gray-300 animate-pulse"></div>
              
              <!-- Authenticated user -->
              <button
                v-else-if="authStore.isAuthenticated"
                class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                @click="toggleUserMenu"
              >
                <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                  {{ userInitials }}
                </div>
                <ChevronDownIcon class="ml-1 h-4 w-4 text-gray-500" />
              </button>

              <!-- Not authenticated - show login link -->
              <router-link
                v-else
                to="/login"
                class="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                Sign In
              </router-link>

              <!-- User dropdown menu -->
              <transition name="fade">
                <div
                  v-if="userMenuOpen"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5"
                >
                  <router-link
                    to="/profile"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    @click="userMenuOpen = false"
                  >
                    <UserIcon class="inline w-4 h-4 mr-2" />
                    Profile
                  </router-link>
                  <button
                    @click="handleLogout"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <ArrowRightOnRectangleIcon class="inline w-4 h-4 mr-2" />
                    Sign out
                  </button>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <transition name="fade">
      <div v-if="mobileMenuOpen" class="md:hidden bg-white border-t border-gray-200">
        <div class="pt-2 pb-3 space-y-1">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="item.to"
            :class="[
              'block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200',
              $route.name === item.name
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            ]"
            @click="mobileMenuOpen = false"
          >
            <component :is="item.icon" class="inline w-5 h-5 mr-3" />
            {{ item.label }}
          </router-link>
        </div>
        <!-- Mobile user info - show loading state, authenticated user, or login link -->
        <div class="pt-4 pb-3 border-t border-gray-200">
          <!-- Loading state -->
          <div v-if="!authStore.initialAuthCheckComplete" class="flex items-center px-4">
            <div class="h-10 w-10 rounded-full bg-gray-300 animate-pulse"></div>
            <div class="ml-3">
              <div class="h-4 w-24 bg-gray-300 animate-pulse rounded"></div>
              <div class="h-3 w-32 bg-gray-300 animate-pulse rounded mt-1"></div>
            </div>
          </div>
          
          <!-- Authenticated user -->
          <div v-else-if="authStore.isAuthenticated" class="flex items-center px-4">
            <div class="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
              {{ userInitials }}
            </div>
            <div class="ml-3">
              <div class="text-base font-medium text-gray-800">{{ user?.username }}</div>
              <div class="text-sm text-gray-500">{{ user?.email }}</div>
            </div>
          </div>
          
          <!-- Not authenticated -->
          <div v-else class="px-4">
            <router-link
              to="/login"
              class="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
              @click="mobileMenuOpen = false"
            >
              Sign In
            </router-link>
          </div>
        </div>
        
        <!-- Menu items for authenticated users -->
        <div v-if="authStore.isAuthenticated && authStore.initialAuthCheckComplete" class="mt-3 space-y-1">
          <router-link
            to="/profile"
            class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            @click="mobileMenuOpen = false"
          >
            Profile
          </router-link>
          <button
            @click="handleLogout"
            class="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </transition>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import {
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  ChevronDownIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  NewspaperIcon,
  RssIcon,
  BookmarkIcon
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const appStore = useAppStore()

const mobileMenuOpen = ref(false)
const userMenuOpen = ref(false)
const userDropdown = ref(null)

// Navigation items
const navItems = [
  {
    name: 'Dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Articles',
    label: 'All Articles',
    to: '/articles',
    icon: NewspaperIcon,
  },
  {
    name: 'Feeds',
    label: 'Browse Feeds',
    to: '/feeds',
    icon: RssIcon,
  },
  {
    name: 'Subscriptions',
    label: 'My Feeds',
    to: '/subscriptions',
    icon: BookmarkIcon,
  },
]

const user = computed(() => authStore.user)
const userInitials = computed(() => {
  const initials = authStore.userInitials
  console.log('[Navigation] Computing userInitials:', initials, 'user:', authStore.user)
  return initials
})

// Toggle user menu
const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value
}

// Close user menu
const closeUserMenu = () => {
  userMenuOpen.value = false
}

// Handle clicks outside the dropdown
const handleClickOutside = (event) => {
  if (userDropdown.value && !userDropdown.value.contains(event.target)) {
    closeUserMenu()
  }
}

// Add/remove event listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Handle logout
const handleLogout = async () => {
  try {
    appStore.setLoading(true)
    await authStore.logout()
  } catch (error) {
    appStore.showError('Error signing out')
  } finally {
    appStore.setLoading(false)
  }
}
</script>

<style scoped>
/* Click away directive would normally be added as a plugin */
/* For now, we'll handle it with native event listeners */
</style>