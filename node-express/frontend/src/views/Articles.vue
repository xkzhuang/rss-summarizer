<template>
  <div>
    <ArticlesContainer
      :title="selectedFeed ? `${selectedFeed.title} - Articles` : 'All Articles'"
      :description="selectedFeed ? `Articles from ${selectedFeed.title}` : 'Browse and read articles from your subscriptions'"
    >
      <template #header-actions>
        <button
          v-if="selectedFeed"
          @click="clearFeedFilter"
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          View All Articles
        </button>
      </template>

      <template #search>
        <ArticlesSearchBar
          v-model:search-query="searchQuery"
          v-model:selected-feed-id="selectedFeedId"
          :subscriptions="subscriptions"
          :loading="loading"
          @search="performSearch"
        />
      </template>

      <template #content>
        <ArticlesList
          :articles="articles"
          :loading="loading"
          :empty-state-title="searchQuery ? 'No articles found' : 'No articles yet'"
          :empty-state-description="searchQuery ? 'Try adjusting your search or filters.' : 'Subscribe to some feeds to start seeing articles here.'"
          :show-browse-button="!searchQuery"
          @article-deleted="handleArticleDeleted"
          @article-updated="handleArticleUpdated"
        />
      </template>

      <template #footer>
        <ArticlesFooter
          :current-page="currentPage"
          :limit="limit"
          :total-articles="totalArticles"
          :has-more="hasMore"
          :loading="loading"
          @previous-page="loadPreviousPage"
          @next-page="loadNextPage"
          @go-to-page="goToPage"
        />
      </template>
    </ArticlesContainer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFeedStore } from '@/stores/feeds'
import { useAppStore } from '@/stores/app'
import { articleService } from '@/services/articles'
import ArticlesContainer from '@/components/articles/ArticlesContainer.vue'
import ArticlesSearchBar from '@/components/articles/ArticlesSearchBar.vue'
import ArticlesList from '@/components/articles/ArticlesList.vue'
import ArticlesFooter from '@/components/articles/ArticlesFooter.vue'

const route = useRoute()
const router = useRouter()
const feedStore = useFeedStore()
const appStore = useAppStore()

// Reactive data
const loading = ref(false)
const articles = ref([])
const searchQuery = ref('')
const selectedFeedId = ref('')

// Pagination
const currentPage = ref(1)
const limit = ref(20)
const totalArticles = ref(0)
const hasMore = ref(false)

// Computed properties
const subscriptions = computed(() => feedStore.subscriptions)
const selectedFeed = computed(() => {
  if (!selectedFeedId.value) return null
  const subscription = subscriptions.value.find(sub => sub.feed?.id === selectedFeedId.value)
  return subscription?.feed || null
})

// Handle article deleted event from ArticlesList
const handleArticleDeleted = (articleId) => {
  console.log('Articles: Handling article deleted:', articleId)
  
  // Remove the article from the local array
  const articleIndex = articles.value.findIndex(a => a.id === articleId)
  if (articleIndex !== -1) {
    articles.value.splice(articleIndex, 1)
    // Update pagination counts
    totalArticles.value = Math.max(0, totalArticles.value - 1)
  }
}

// Handle article updated event from ArticlesList (for summary generation)
const handleArticleUpdated = (updatedArticle) => {
  console.log('Articles: Handling article updated:', updatedArticle.id)
  
  // Find and replace the article in the local array
  const articleIndex = articles.value.findIndex(a => a.id === updatedArticle.id)
  if (articleIndex !== -1) {
    articles.value[articleIndex] = updatedArticle
    console.log('Articles: Article updated in local array')
  }
}

// Load articles
const loadArticles = async (resetPagination = true) => {
  console.log('Loading articles, resetPagination:', resetPagination)
  if (resetPagination) {
    currentPage.value = 1
  }
  
  loading.value = true
  
  try {
    const params = {
      limit: limit.value,
      offset: (currentPage.value - 1) * limit.value,
    }
    
    // Note: Don't include userId in params - let the backend determine from auth token
    // This prevents caching issues when userId changes or becomes null
    
    // Add search query if provided
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    
    // Add feedId filter if selected
    if (selectedFeedId.value) {
      params.feedId = selectedFeedId.value
    }
    
    console.log('Loading articles with params:', params) // Debug log
    
    const response = await articleService.getArticles(params)
    
    articles.value = response.data?.articles || []
    totalArticles.value = response.data?.pagination?.total || 0
    hasMore.value = response.data?.pagination?.hasMore || false
    
    console.log(`Loaded ${articles.value.length} articles, total: ${totalArticles.value}`) // Debug log
    
  } catch (error) {
    console.error('Error loading articles:', error)
    appStore.showError('Failed to load articles')
    articles.value = []
  } finally {
    loading.value = false
  }
}

// Search functionality
const performSearch = () => {
  loadArticles(true)
}

// Pagination functions
const loadNextPage = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++
    loadArticles(false)
  }
}

const loadPreviousPage = () => {
  if (currentPage.value > 1 && !loading.value) {
    currentPage.value--
    loadArticles(false)
  }
}

const goToPage = (page) => {
  if (page !== currentPage.value && !loading.value) {
    currentPage.value = page
    loadArticles(false)
  }
}

// Clear feed filter
const clearFeedFilter = () => {
  router.push({ path: '/articles' })
}

// Watch for route changes (if coming from search params)
watch(() => route.query, (newQuery, oldQuery) => {
  let shouldReload = false
  
  if (newQuery.search !== oldQuery?.search) {
    searchQuery.value = newQuery.search || ''
    shouldReload = true
  }
  if (newQuery.feed !== oldQuery?.feed) {
    selectedFeedId.value = newQuery.feed || ''
    shouldReload = true
  }
  
  // Only reload if this isn't the initial load and something changed
  if (oldQuery && shouldReload) {
    console.log('Route query changed, reloading articles...') // Debug log
    loadArticles(true)
  }
}, { immediate: true })

// Watch for changes in search query and selected feed to trigger auto-reload
watch([searchQuery, selectedFeedId], ([newSearch, newFeedId], [oldSearch, oldFeedId]) => {
  // Don't trigger on initial mount when both are empty
  if (oldSearch === undefined && oldFeedId === undefined) return
  
  // Trigger reload when search or feed changes
  if (newSearch !== oldSearch || newFeedId !== oldFeedId) {
    console.log('Search or feed filter changed, reloading...') // Debug log
    loadArticles(true)
  }
})

// Load data on mount
onMounted(async () => {
  // Always load subscriptions to ensure fresh data
  await feedStore.fetchSubscriptions()
  
  // Initialize from route query parameters
  if (route.query.search) {
    searchQuery.value = route.query.search
  }
  if (route.query.feed) {
    selectedFeedId.value = route.query.feed
  }
  
  // Load articles
  loadArticles()
})

// Watch for route changes to refresh data when switching back to this tab
watch(() => route.name, (newRouteName, oldRouteName) => {
  if (newRouteName === 'Articles' && oldRouteName !== 'Articles') {
    console.log('Switched to Articles tab - refreshing data')
    // Force refresh when switching to Articles tab
    feedStore.fetchSubscriptions().then(() => {
      loadArticles()
    })
  }
}, { immediate: false })
</script>

<style scoped>
/* Styles moved to ArticlesList.vue component */
</style>