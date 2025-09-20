<template>
  <div class="bg-white shadow rounded-lg p-6">
    <div class="flex flex-col sm:flex-row gap-4">
      <!-- Search Input -->
      <div class="flex-1">
        <label for="search" class="sr-only">Search articles</label>
        <div class="relative">
          <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            id="search"
            :value="searchQuery"
            @input="$emit('update:searchQuery', $event.target.value)"
            type="text"
            placeholder="Search articles..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            @keyup.enter="$emit('search')"
          />
        </div>
      </div>

      <!-- Feed Filter -->
      <div v-if="showFeedFilter" class="sm:w-48">
        <select
          :value="selectedFeedId"
          @change="$emit('update:selectedFeedId', $event.target.value)"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        >
          <option value="">All Feeds</option>
          <option
            v-for="subscription in subscriptions"
            :key="subscription.feed?.id"
            :value="subscription.feed?.id"
          >
            {{ subscription.feed?.title }}
          </option>
        </select>
      </div>

      <!-- Search Button -->
      <button
        @click="$emit('search')"
        :disabled="loading"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
      >
        <MagnifyingGlassIcon class="h-4 w-4 mr-2" />
        Search
      </button>
    </div>
  </div>
</template>

<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  selectedFeedId: {
    type: String,
    default: ''
  },
  subscriptions: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  showFeedFilter: {
    type: Boolean,
    default: true
  }
})

defineEmits([
  'update:searchQuery',
  'update:selectedFeedId',
  'search'
])
</script>