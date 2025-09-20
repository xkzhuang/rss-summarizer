<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
      <p class="mt-2 text-gray-600">
        Welcome back, {{ user?.username }}! Here's your news feed summary.
      </p>
    </div>

    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <RssIcon class="h-6 w-6 text-gray-400" />
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">
                  Active Feeds
                </dt>
                <dd class="text-lg font-medium text-gray-900">
                  {{ stats.activeFeeds }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <NewspaperIcon class="h-6 w-6 text-gray-400" />
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">
                  Unread Articles
                </dt>
                <dd class="text-lg font-medium text-gray-900">
                  {{ stats.unreadArticles }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <DocumentTextIcon class="h-6 w-6 text-gray-400" />
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">
                  Summaries Generated
                </dt>
                <dd class="text-lg font-medium text-gray-900">
                  {{ stats.summariesGenerated }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Recent Articles -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-medium text-gray-900">Recent Articles</h2>
          </div>
          <ArticlesList
            :articles="recentArticles"
            :loading="loading"
            :limit="5"
            :compact="true"
            :show-delete-button="true"
            :show-view-more="recentArticles.length > 0"
            :empty-state-title="'No articles yet'"
            :empty-state-description="'Subscribe to some feeds to start seeing articles here.'"
            @article-deleted="handleArticleDeleted"
            @article-updated="handleArticleUpdated"
          />
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Quick Actions -->
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-medium text-gray-900">Quick Actions</h2>
          </div>
          <div class="p-6 space-y-3">
            <router-link
              to="/feeds"
              class="block w-full text-left px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RssIcon class="inline h-4 w-4 mr-2" />
              Browse New Feeds
            </router-link>
            <router-link
              to="/subscriptions"
              class="block w-full text-left px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <BookmarkIcon class="inline h-4 w-4 mr-2" />
              Manage Subscriptions
            </router-link>
            <router-link
              to="/profile"
              class="block w-full text-left px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CogIcon class="inline h-4 w-4 mr-2" />
              Account Settings
            </router-link>
          </div>
        </div>

        <!-- Recent Subscriptions -->
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-medium text-gray-900">My Feeds</h2>
          </div>
          <div class="p-6">
            <div v-if="subscriptions.length === 0" class="text-center text-gray-500 text-sm">
              No subscriptions yet.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="subscription in subscriptions.slice(0, 5)"
                :key="subscription.id"
                class="flex items-center space-x-3"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">
                    {{ subscription.feed?.title }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ subscription.feed?.description }}
                  </p>
                </div>
              </div>
              <div v-if="subscriptions.length > 5" class="text-center">
                <router-link
                  to="/subscriptions"
                  class="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  View all →
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feeds'
import { useAppStore } from '@/stores/app'
import { articleService } from '@/services/articles'
import ArticlesList from '@/components/articles/ArticlesList.vue'
import {
  RssIcon,
  NewspaperIcon,
  DocumentTextIcon,
  BookmarkIcon,
  CogIcon
} from '@heroicons/vue/24/outline'

const authStore = useAuthStore()
const feedStore = useFeedStore()
const appStore = useAppStore()
const route = useRoute()

const loading = ref(false)
const recentArticles = ref([])

const user = computed(() => authStore.user)
const subscriptions = computed(() => feedStore.subscriptions)

// Mock stats - in real app, these would come from API
const stats = ref({
  activeFeeds: 0,
  unreadArticles: 0,
  summariesGenerated: 0,
})

// Handle article deleted event from ArticlesList
const handleArticleDeleted = (articleId) => {
  console.log('Dashboard: Handling article deleted:', articleId)
  
  // Remove the article from the local array
  const articleIndex = recentArticles.value.findIndex(a => a.id === articleId)
  if (articleIndex !== -1) {
    recentArticles.value.splice(articleIndex, 1)
    console.log('Dashboard: Article removed from local array')
  }
  
  // Update stats after deletion
  updateStats()
}

// Handle article updated event from ArticlesList (for summary generation)
const handleArticleUpdated = (updatedArticle) => {
  console.log('Dashboard: Handling article updated:', updatedArticle.id)
  
  // Find and replace the article in the local array
  const articleIndex = recentArticles.value.findIndex(a => a.id === updatedArticle.id)
  if (articleIndex !== -1) {
    recentArticles.value[articleIndex] = updatedArticle
    console.log('Dashboard: Article updated in local array')
  }
  
  // Update stats after article update
  updateStats()
}

// Update stats helper
const updateStats = () => {
  stats.value = {
    activeFeeds: subscriptions.value.length,
    unreadArticles: recentArticles.value.filter(article => !article.isRead).length,
    summariesGenerated: recentArticles.value.filter(article => article.hasSummary).length,
  }
  console.log('Dashboard: Stats updated')
}

// Load dashboard data
const loadDashboardData = async () => {
  console.log('Loading dashboard data')
  loading.value = true
  
  try {
    // Load subscriptions
    await feedStore.fetchSubscriptions()
    
    // Load recent articles for user's subscriptions
    const response = await articleService.getArticles({
      limit: 10
      // Note: Don't include userId in params - let the backend determine from auth token
    })
    
    recentArticles.value = response.data?.articles || []
    
    // Update stats
    updateStats()
  } catch (error) {
    console.error('Error loading dashboard:', error)
    appStore.showError('Failed to load dashboard data')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboardData()
})

// Watch for route changes to refresh data when switching back to this tab  
watch(() => route.name, (newRouteName, oldRouteName) => {
  if (newRouteName === 'Dashboard' && oldRouteName !== 'Dashboard') {
    console.log('Switched to Dashboard tab - refreshing data')
    // Force refresh when switching to Dashboard tab
    loadDashboardData()
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>