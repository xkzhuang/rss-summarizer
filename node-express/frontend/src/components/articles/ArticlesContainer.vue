<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">
            {{ title }}
          </h1>
          <p class="mt-2 text-gray-600">
            {{ description }}
          </p>
        </div>
        <div class="flex-shrink-0">
          <slot name="header-actions"></slot>
        </div>
      </div>
    </div>

    <!-- Search Bar Slot -->
    <div v-if="showSearch" class="mb-6">
      <slot name="search"></slot>
    </div>

    <!-- Articles List Slot -->
    <div>
      <slot name="content"></slot>
    </div>

    <!-- Footer/Pagination Slot -->
    <div v-if="showFooter" class="mt-6">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  showSearch: {
    type: Boolean,
    default: true
  },
  showFooter: {
    type: Boolean,
    default: true
  }
})
</script>