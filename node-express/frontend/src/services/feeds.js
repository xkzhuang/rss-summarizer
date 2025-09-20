import api from './api'

export const feedService = {
  // Get all feeds (with pagination and search)
  async getFeeds(params = {}) {
    const response = await api.get('/feeds', { params })
    return response.data
  },

  // Get feed by ID
  async getFeed(feedId) {
    const response = await api.get(`/feeds/${feedId}`)
    return response.data
  },

  // Add new feed
  async addFeed(feedData) {
    const response = await api.post('/feeds', feedData)
    return response.data
  },

  // Update feed
  async updateFeed(feedId, feedData) {
    const response = await api.put(`/feeds/${feedId}`, feedData)
    return response.data
  },

  // Delete feed
  async deleteFeed(feedId) {
    const response = await api.delete(`/feeds/${feedId}`)
    return response.data
  },

  // Search feeds
  async searchFeeds(query) {
    const response = await api.get('/feeds/search', { 
      params: { q: query } 
    })
    return response.data
  },

  // Get popular feeds
  async getPopularFeeds(limit = 10) {
    const response = await api.get('/feeds/popular', {
      params: { limit }
    })
    return response.data
  },

  // Validate feed URL
  async validateFeedUrl(url) {
    const response = await api.post('/feeds/validate', { url })
    return response.data
  },

  // Manually fetch articles for a feed
  async fetchFeedArticles(feedId) {
    const response = await api.post(`/feeds/${feedId}/fetch`)
    return response.data
  },

  // Fetch articles for all feeds (admin only)
  async fetchAllFeedArticles() {
    const response = await api.post('/feeds/fetch-all')
    return response.data
  }
}