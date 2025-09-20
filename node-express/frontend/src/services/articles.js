import api from './api'

export const articleService = {
  // Get articles (with pagination and filters)
  async getArticles(params = {}) {
    const response = await api.get('/articles', { params })
    return response.data
  },

  // Get article by ID
  async getArticle(articleId) {
    const response = await api.get(`/articles/${articleId}`)
    return response.data
  },

  // Get articles from specific feed
  async getFeedArticles(feedId, params = {}) {
    const response = await api.get(`/feeds/${feedId}/articles`, { params })
    return response.data
  },

  // Get article summaries
  async getArticleSummaries(articleId) {
    const response = await api.get(`/articles/${articleId}/summaries`)
    return response.data
  },

  // Generate summary for article
  async generateSummary(articleId, summaryType = 'brief') {
    try {
      const response = await api.post(`/articles/${articleId}/summarize`, {
        type: summaryType
      })
      return response.data
    } catch (error) {
      // Re-throw with more specific error information
      if (error.response?.data?.error?.code === 'OPENAI_API_KEY_REQUIRED') {
        const enhancedError = new Error(error.response.data.message || 'OpenAI API key required')
        enhancedError.code = 'OPENAI_API_KEY_REQUIRED'
        enhancedError.originalError = error
        throw enhancedError
      }
      throw error
    }
  },

  // Delete article
  async deleteArticle(articleId) {
    const response = await api.delete(`/articles/${articleId}`)
    return response.data
  },

  // Mark article as read
  async markAsRead(articleId) {
    const response = await api.post(`/articles/${articleId}/read`)
    return response.data
  },

  // Get user's reading history
  async getReadingHistory(params = {}) {
    const response = await api.get('/articles/history', { params })
    return response.data
  }
}