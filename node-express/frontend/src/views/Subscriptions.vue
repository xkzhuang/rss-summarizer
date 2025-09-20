<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">My Subscriptions</h1>
      <p class="mt-2 text-gray-600">
        Manage your RSS feed subscriptions and view recent articles
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="spinner"></div>
      <span class="ml-2 text-gray-500">Loading subscriptions...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="subscriptions.length === 0" class="text-center py-12">
      <RssIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-lg font-medium text-gray-900">No subscriptions yet</h3>
      <p class="mt-1 text-sm text-gray-500">
        Start by subscribing to some feeds to see articles here.
      </p>
      <div class="mt-6">
        <router-link
          to="/feeds"
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusIcon class="-ml-1 mr-2 h-4 w-4" />
          Browse Feeds
        </router-link>
      </div>
    </div>

    <!-- Subscriptions List -->
    <div v-else class="space-y-6">
      <div
        v-for="subscription in subscriptions"
        :key="subscription.id"
        class="bg-white shadow rounded-lg"
      >
        <!-- Subscription Header -->
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-3">
                <h2 class="text-xl font-semibold text-gray-900">
                  {{ subscription.feed?.title }}
                </h2>
                <span
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    subscription.feed?.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  ]"
                >
                  {{ subscription.feed?.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-600">
                {{ subscription.feed?.description }}
              </p>
              <div class="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <a :href="subscription.feed?.url" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600">
                  {{ subscription.feed?.url }}
                </a>
                <span v-if="subscription.feed?.link">•</span>
                <a v-if="subscription.feed?.link" :href="subscription.feed?.link" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600">
                  Visit Website
                </a>
                <span v-if="subscription.feed?.lastFetched">•</span>
                <span v-if="subscription.feed?.lastFetched">
                  Last updated: {{ formatDate(subscription.feed.lastFetched) }}
                </span>
              </div>
            </div>
            <div class="flex-shrink-0 ml-4 flex space-x-2">
              <button
                @click="refreshFeed(subscription.feed.id)"
                :disabled="refreshing[subscription.feed.id]"
                class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <span v-if="refreshing[subscription.feed.id]" class="spinner-sm mr-2"></span>
                <ArrowPathIcon class="h-4 w-4" :class="{ 'mr-1': !refreshing[subscription.feed.id] }" />
                <span v-if="!refreshing[subscription.feed.id]">Refresh</span>
              </button>
              <button
                @click="handleUnsubscribe(subscription.feed.id)"
                :disabled="unsubscribing[subscription.feed.id]"
                class="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                <span v-if="unsubscribing[subscription.feed.id]" class="spinner-sm mr-2"></span>
                <XMarkIcon class="h-4 w-4" :class="{ 'mr-1': !unsubscribing[subscription.feed.id] }" />
                <span v-if="!unsubscribing[subscription.feed.id]">Unsubscribe</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Articles -->
        <div class="px-6 py-4">
          <div v-if="loadingArticles[subscription.feed.id]" class="text-center py-4">
            <div class="spinner-sm mx-auto"></div>
            <p class="mt-2 text-sm text-gray-500">Loading articles...</p>
          </div>
          
          <div v-else-if="!articles[subscription.feed.id] || articles[subscription.feed.id].length === 0" class="text-center py-4 text-gray-500 text-sm">
            No articles available
          </div>
          
          <div v-else class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Articles</h3>
            <div
              v-for="article in articles[subscription.feed.id].slice(0, 5)"
              :key="article.id"
              class="border-l-4 border-primary-200 pl-4 py-2"
            >
              <h4 class="text-sm font-medium text-gray-900 hover:text-primary-600">
                <a :href="article.url" target="_blank" rel="noopener noreferrer">
                  {{ article.title }}
                </a>
              </h4>
              <p class="mt-1 text-sm text-gray-600 line-clamp-2">
                {{ article.description || 'No description available.' }}
              </p>
              <div class="mt-2 flex items-center justify-between">
                <div class="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{{ formatDate(article.pubDate) }}</span>
                  <span v-if="article.author">•</span>
                  <span v-if="article.author">{{ article.author }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    v-if="!article.hasSummary"
                    @click="generateSummary(article.id)"
                    :disabled="generatingSummary[article.id]"
                    class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 disabled:opacity-50"
                  >
                    <span v-if="generatingSummary[article.id]" class="spinner-sm mr-1"></span>
                    Summarize
                  </button>
                  <span v-else class="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-green-700 bg-green-100">
                    ✓ Summarized
                  </span>
                  <button
                    v-if="!article.isRead"
                    @click="markAsRead(article.id)"
                    class="text-xs text-gray-500 hover:text-primary-600"
                  >
                    Mark as read
                  </button>
                </div>
              </div>
            </div>
            
            <div v-if="articles[subscription.feed.id].length > 5" class="text-center pt-4">
              <button
                @click="viewAllArticles(subscription.feed.id)"
                class="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all {{ articles[subscription.feed.id].length }} articles →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFeedStore } from '@/stores/feeds'
import { useAppStore } from '@/stores/app'
import { articleService } from '@/services/articles'
import { feedService } from '@/services/feeds'
import {
  RssIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const feedStore = useFeedStore()
const appStore = useAppStore()

const loading = ref(false)
const articles = ref({})
const loadingArticles = ref({})
const refreshing = ref({})
const unsubscribing = ref({})
const generatingSummary = ref({})

const subscriptions = computed(() => feedStore.subscriptions)

// Format date helper
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Load articles for a feed
const loadFeedArticles = async (feedId) => {
  loadingArticles.value[feedId] = true
  
  try {
    const response = await articleService.getArticles({
      feedId: feedId,
      limit: 20
    })
    
    articles.value[feedId] = response.data.articles || []
  } catch (error) {
    console.error('Error loading articles:', error)
    appStore.showError('Failed to load articles')
  } finally {
    loadingArticles.value[feedId] = false
  }
}

// Refresh feed
const refreshFeed = async (feedId) => {
  refreshing.value[feedId] = true
  
  try {
    // Trigger article fetch from RSS feed
    await feedService.fetchFeedArticles(feedId)
    appStore.showSuccess('Feed refreshed successfully!')
    
    // Reload articles after fetching
    await loadFeedArticles(feedId)
  } catch (error) {
    console.error('Error refreshing feed:', error)
    appStore.showError('Failed to refresh feed')
  } finally {
    refreshing.value[feedId] = false
  }
}

// Handle unsubscription
const handleUnsubscribe = async (feedId) => {
  if (!confirm('Are you sure you want to unsubscribe from this feed?')) {
    return
  }
  
  unsubscribing.value[feedId] = true
  
  try {
    await feedStore.unsubscribe(feedId)
    appStore.showSuccess('Successfully unsubscribed from feed!')
  } catch (error) {
    console.error('Unsubscribe error:', error)
    appStore.showError('Failed to unsubscribe from feed')
  } finally {
    unsubscribing.value[feedId] = false
  }
}

// Generate summary for article
const generateSummary = async (articleId) => {
  generatingSummary.value[articleId] = true
  
  try {
    await articleService.generateSummary(articleId)
    appStore.showSuccess('Summary generated successfully!')
    
    // Update article to show it has summary
    Object.keys(articles.value).forEach(feedId => {
      const article = articles.value[feedId].find(a => a.id === articleId)
      if (article) {
        article.hasSummary = true
      }
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    appStore.showError('Failed to generate summary')
  } finally {
    generatingSummary.value[articleId] = false
  }
}

// Mark article as read
const markAsRead = async (articleId) => {
  try {
    await articleService.markAsRead(articleId)
    
    // Update article status
    Object.keys(articles.value).forEach(feedId => {
      const article = articles.value[feedId].find(a => a.id === articleId)
      if (article) {
        article.isRead = true
      }
    })
  } catch (error) {
    console.error('Error marking article as read:', error)
    appStore.showError('Failed to mark article as read')
  }
}

// View all articles for a feed
const viewAllArticles = (feedId) => {
  // Navigate to Articles page with feed filter
  router.push({
    path: '/articles',
    query: { feed: feedId }
  })
}

// Load subscriptions and their articles
const loadSubscriptionsData = async () => {
  loading.value = true
  
  try {
    await feedStore.fetchSubscriptions()
    
    // Load articles for each subscription
    for (const subscription of subscriptions.value) {
      if (subscription.feed?.id) {
        await loadFeedArticles(subscription.feed.id)
      }
    }
  } catch (error) {
    console.error('Error loading subscriptions:', error)
    appStore.showError('Failed to load subscriptions')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSubscriptionsData()
})

// Watch for route changes to refresh data when switching back to this tab
watch(() => route.name, (newRouteName, oldRouteName) => {
  if (newRouteName === 'Subscriptions' && oldRouteName !== 'Subscriptions') {
    console.log('Switched to Subscriptions tab - refreshing data')
    // Force refresh when switching to Subscriptions tab
    loadSubscriptionsData()
  }
}, { immediate: false })
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spinner-sm {
  border: 1px solid #f3f3f3;
  border-top: 1px solid #3498db;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  animation: spin 1s linear infinite;
}
</style>