import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    isLoading: false,
    notifications: [],
    sidebarOpen: false,
  }),

  actions: {
    // Set loading state
    setLoading(loading) {
      this.isLoading = loading
    },

    // Add notification
    addNotification(notification) {
      const id = Date.now() + Math.random()
      const toast = {
        id,
        type: 'info',
        duration: 3000,
        ...notification,
      }
      
      this.notifications.push(toast)
      
      // Auto remove after duration
      setTimeout(() => {
        this.removeNotification(id)
      }, toast.duration)
      
      return id
    },

    // Remove notification
    removeNotification(id) {
      const index = this.notifications.findIndex(n => n.id === id)
      if (index > -1) {
        this.notifications.splice(index, 1)
      }
    },

    // Clear all notifications
    clearNotifications() {
      this.notifications = []
    },

    // Success notification
    showSuccess(message) {
      return this.addNotification({
        type: 'success',
        message,
      })
    },

    // Error notification
    showError(message) {
      return this.addNotification({
        type: 'error',
        message,
        duration: 5000, // Show errors longer
      })
    },

    // Warning notification
    showWarning(message) {
      return this.addNotification({
        type: 'warning',
        message,
        duration: 5000, // Show warnings longer
      })
    },

    // Info notification
    showInfo(message) {
      return this.addNotification({
        type: 'info',
        message,
      })
    },

    // Toggle sidebar
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    // Set sidebar state
    setSidebarOpen(open) {
      this.sidebarOpen = open
    },
  },
})