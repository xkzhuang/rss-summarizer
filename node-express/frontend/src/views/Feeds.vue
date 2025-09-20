<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Browse Feeds</h1>
        <p class="mt-2 text-gray-600">
          Discover and subscribe to RSS/Atom feeds
        </p>
      </div>
      <button
        @click="showAddFeedModal = true"
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
      >
        <PlusIcon class="-ml-1 mr-2 h-4 w-4" />
        Add Feed
      </button>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white shadow rounded-lg mb-6">
      <div class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <label for="search" class="sr-only">Search feeds</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="search"
                v-model="searchQuery"
                type="text"
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search feeds..."
                @keyup.enter="handleSearch"
              />
            </div>
          </div>
          <div class="flex space-x-3">
            <button
              @click="handleSearch"
              :disabled="loading"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              Search
            </button>
            <button
              @click="loadPopularFeeds"
              :disabled="loading"
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Popular
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Feeds List -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">
          {{ searchQuery ? `Search Results for "${searchQuery}"` : 'Available Feeds' }}
        </h2>
      </div>
      
      <div v-if="loading" class="p-6 text-center">
        <div class="spinner mx-auto"></div>
        <p class="mt-2 text-gray-500">Loading feeds...</p>
      </div>
      
      <div v-else-if="feeds.length === 0" class="p-6 text-center">
        <RssIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No feeds found</h3>
        <p class="mt-1 text-sm text-gray-500">
          Try adjusting your search or browse popular feeds.
        </p>
      </div>
      
      <div v-else class="divide-y divide-gray-200">
        <div
          v-for="feed in feeds"
          :key="feed.id"
          class="p-6 hover:bg-gray-50"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-3">
                <h3 class="text-lg font-medium text-gray-900">
                  {{ feed.title }}
                </h3>
                <span
                  v-if="feedStore.isSubscribed(feed.id)"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  Subscribed
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-600">
                {{ feed.description }}
              </p>
              <div class="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <a :href="feed.url" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600">
                  {{ feed.url }}
                </a>
                <span v-if="feed.link">•</span>
                <a v-if="feed.link" :href="feed.link" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600">
                  Visit Website
                </a>
                <span v-if="feed.subscriberCount">•</span>
                <span v-if="feed.subscriberCount">
                  {{ feed.subscriberCount }} subscribers
                </span>
              </div>
            </div>
            <div class="flex-shrink-0 ml-4">
              <button
                v-if="!feedStore.isSubscribed(feed.id)"
                @click="handleSubscribe(feed.id)"
                :disabled="subscribing[feed.id]"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <span v-if="subscribing[feed.id]" class="spinner-sm mr-2"></span>
                Subscribe
              </button>
              <button
                v-else
                @click="handleUnsubscribe(feed.id)"
                :disabled="subscribing[feed.id]"
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <span v-if="subscribing[feed.id]" class="spinner-sm mr-2"></span>
                Unsubscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200">
        <nav class="flex items-center justify-between">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="previousPage"
              :disabled="pagination.page === 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="pagination.page === pagination.totalPages"
              class="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing page {{ pagination.page }} of {{ pagination.totalPages }}
              </p>
            </div>
            <div>
              <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  @click="previousPage"
                  :disabled="pagination.page === 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  @click="nextPage"
                  :disabled="pagination.page === pagination.totalPages"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </nav>
      </div>
    </div>

    <!-- Add Feed Modal -->
    <div
      v-if="showAddFeedModal"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      @click="showAddFeedModal = false"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
        @click.stop
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Add New Feed</h3>
          <form @submit.prevent="handleAddFeed">
            <div class="mb-4">
              <label for="feedUrl" class="block text-sm font-medium text-gray-700 mb-2">
                Feed URL
              </label>
              <input
                id="feedUrl"
                v-model="newFeedUrl"
                type="url"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://example.com/feed.xml"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                @click="showAddFeedModal = false"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="addingFeed"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <span v-if="addingFeed" class="spinner-sm mr-2"></span>
                Add Feed
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFeedStore } from '@/stores/feeds'
import { useAppStore } from '@/stores/app'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  RssIcon
} from '@heroicons/vue/24/outline'

const feedStore = useFeedStore()
const appStore = useAppStore()
const route = useRoute()

const loading = ref(false)
const searchQuery = ref('')
const showAddFeedModal = ref(false)
const newFeedUrl = ref('')
const addingFeed = ref(false)
const subscribing = ref({})

const feeds = computed(() => feedStore.feeds)
const pagination = computed(() => feedStore.pagination)

// Handle search
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    return await feedStore.fetchFeeds()
  }
  
  try {
    await feedStore.searchFeeds(searchQuery.value)
  } catch (error) {
    console.error('Search error:', error)
    appStore.showError('Failed to search feeds')
  }
}

// Load popular feeds
const loadPopularFeeds = async () => {
  try {
    const response = await feedStore.fetchPopularFeeds()
    if (response.success) {
      feedStore.feeds = response.data
    }
  } catch (error) {
    console.error('Error loading popular feeds:', error)
    appStore.showError('Failed to load popular feeds')
  }
}

// Handle subscription
const handleSubscribe = async (feedId) => {
  subscribing.value[feedId] = true
  
  try {
    await feedStore.subscribe(feedId)
    appStore.showSuccess('Successfully subscribed to feed!')
  } catch (error) {
    console.error('Subscribe error:', error)
    appStore.showError('Failed to subscribe to feed')
  } finally {
    subscribing.value[feedId] = false
  }
}

// Handle unsubscription
const handleUnsubscribe = async (feedId) => {
  subscribing.value[feedId] = true
  
  try {
    await feedStore.unsubscribe(feedId)
    appStore.showSuccess('Successfully unsubscribed from feed!')
  } catch (error) {
    console.error('Unsubscribe error:', error)
    appStore.showError('Failed to unsubscribe from feed')
  } finally {
    subscribing.value[feedId] = false
  }
}

// Handle add new feed
const handleAddFeed = async () => {
  addingFeed.value = true
  
  try {
    const response = await feedStore.addFeed({ url: newFeedUrl.value })
    
    // Check if there's a warning in the response message
    if (response.message && response.message.includes('Warning:')) {
      appStore.showWarning(response.message)
    } else {
      appStore.showSuccess(response.message || 'Feed added successfully!')
    }
    
    showAddFeedModal.value = false
    newFeedUrl.value = ''
  } catch (error) {
    console.error('Add feed error:', error)
    appStore.showError(error.response?.data?.message || 'Failed to add feed')
  } finally {
    addingFeed.value = false
  }
}

// Pagination
const previousPage = async () => {
  if (pagination.value.page > 1) {
    feedStore.setPage(pagination.value.page - 1)
    await feedStore.fetchFeeds()
  }
}

const nextPage = async () => {
  if (pagination.value.page < pagination.value.totalPages) {
    feedStore.setPage(pagination.value.page + 1)
    await feedStore.fetchFeeds()
  }
}

onMounted(async () => {
  // Load subscriptions and feeds
  await Promise.all([
    feedStore.fetchSubscriptions(),
    feedStore.fetchFeeds()
  ])
})

// Watch for route changes to refresh data when switching back to this tab
watch(() => route.name, (newRouteName, oldRouteName) => {
  if (newRouteName === 'Feeds' && oldRouteName !== 'Feeds') {
    console.log('Switched to Feeds tab - refreshing data')
    // Force refresh when switching to Feeds tab
    Promise.all([
      feedStore.fetchSubscriptions(),
      feedStore.fetchFeeds()
    ])
  }
}, { immediate: false })
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