import api from './api'

export const subscriptionService = {
  // Get user's subscriptions
  async getSubscriptions() {
    const response = await api.get('/subscriptions')
    return response.data
  },

  // Subscribe to a feed
  async subscribe(feedId) {
    const response = await api.post('/subscriptions', { feedId })
    return response.data
  },

  // Unsubscribe from a feed
  async unsubscribe(feedId) {
    const response = await api.delete(`/subscriptions/${feedId}`)
    return response.data
  },

  // Get subscription details
  async getSubscription(feedId) {
    const response = await api.get(`/subscriptions/${feedId}`)
    return response.data
  },

  // Update subscription settings
  async updateSubscription(feedId, settings) {
    const response = await api.put(`/subscriptions/${feedId}`, settings)
    return response.data
  }
}