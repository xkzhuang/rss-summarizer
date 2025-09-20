import { defineStore } from 'pinia'
import { feedService } from '@/services/feeds'
import { subscriptionService } from '@/services/subscriptions'

export const useFeedStore = defineStore('feeds', {
  state: () => ({
    feeds: [],
    subscriptions: [],
    currentFeed: null,
    loading: false,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  }),

  getters: {
    subscribedFeedIds: (state) => 
      state.subscriptions.map(sub => sub.feedId || sub.feed?.id).filter(Boolean),
    
    isSubscribed: (state) => (feedId) => {
      // First check direct subscriptions array
      const directMatch = state.subscriptions.some(sub => 
        sub.feedId === feedId || sub.feed?.id === feedId
      )
      if (directMatch) return true
      
      // Also check if current user ID appears in feed's subscriptions array
      const currentUserId = state.subscriptions[0]?.userId
      if (currentUserId) {
        const feed = state.feeds.find(f => f.id === feedId)
        if (feed && feed.subscriptions) {
          return feed.subscriptions.some(sub => sub.userId === currentUserId)
        }
      }
      
      return false
    },
    
    subscribedFeeds: (state) => 
      state.feeds.filter(feed => 
        state.subscriptions.some(sub => 
          sub.feedId === feed.id || sub.feed?.id === feed.id
        )
      ),
    
    currentUserId: (state) => {
      // Get user ID from subscriptions, but ensure it's stable
      const firstSubscription = state.subscriptions[0]
      return firstSubscription?.userId || null
    },
  },

  actions: {
    // Get all feeds
    async fetchFeeds(params = {}) {
      this.loading = true
      try {
        const response = await feedService.getFeeds({
          page: this.pagination.page,
          limit: this.pagination.limit,
          ...params,
        })
        
        if (response.success) {
          this.feeds = response.data.feeds || response.data
          this.pagination = {
            ...this.pagination,
            ...response.data.pagination,
          }
        }
        
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Get feed by ID
    async fetchFeed(feedId) {
      this.loading = true
      try {
        const response = await feedService.getFeed(feedId)
        if (response.success) {
          this.currentFeed = response.data
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Add new feed
    async addFeed(feedData) {
      this.loading = true
      try {
        const response = await feedService.addFeed(feedData)
        if (response.success) {
          // Add the feed to the feeds array
          this.feeds.unshift(response.data.feed || response.data)
          
          // If subscription data is included, add it to subscriptions
          if (response.data.subscription) {
            this.subscriptions.push(response.data.subscription)
          }
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Search feeds
    async searchFeeds(query) {
      this.loading = true
      try {
        const response = await feedService.searchFeeds(query)
        if (response.success) {
          this.feeds = response.data
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Get popular feeds
    async fetchPopularFeeds(limit = 10) {
      try {
        const response = await feedService.getPopularFeeds(limit)
        return response
      } catch (error) {
        throw error
      }
    },

    // Get user subscriptions
    async fetchSubscriptions() {
      this.loading = true
      try {
        const response = await subscriptionService.getSubscriptions()
        if (response.success) {
          this.subscriptions = response.data
        }
        return response
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },

    // Subscribe to feed
    async subscribe(feedId) {
      try {
        const response = await subscriptionService.subscribe(feedId)
        if (response.success) {
          this.subscriptions.push(response.data)
        }
        return response
      } catch (error) {
        throw error
      }
    },

    // Unsubscribe from feed
    async unsubscribe(feedId) {
      try {
        const response = await subscriptionService.unsubscribe(feedId)
        if (response.success) {
          this.subscriptions = this.subscriptions.filter(
            sub => sub.feedId !== feedId
          )
        }
        return response
      } catch (error) {
        throw error
      }
    },

    // Set pagination page
    setPage(page) {
      this.pagination.page = page
    },

    // Reset pagination
    resetPagination() {
      this.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      }
    },
  },
})