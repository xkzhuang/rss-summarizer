# RSS Feed Summarizer - Frontend

A modern Vue 3 frontend application for the RSS Feed Summarization Platform.

## Features

- 🔐 **Authentication**: Secure user registration and login
- 📰 **Feed Management**: Browse, search, and subscribe to RSS/Atom feeds
- 📋 **Dashboard**: View recent articles and feed statistics
- 🤖 **AI Summaries**: Generate article summaries using OpenAI GPT
- ⚙️ **Profile Management**: Account settings and OpenAI API key configuration
- 📱 **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **Vue 3** with Composition API
- **Vite** for fast development and building
- **Vue Router** for navigation
- **Pinia** for state management
- **Axios** for API communication
- **Tailwind CSS** for styling
- **Heroicons** for icons
- **Headless UI** for accessible components

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Application Configuration
VITE_APP_NAME=RSS Feed Summarizer
VITE_APP_VERSION=1.0.0
```

## Project Structure

```
src/
├── components/          # Reusable components
│   └── Navigation.vue   # Main navigation component
├── router/              # Vue Router configuration
│   └── index.js         # Routes and navigation guards
├── services/            # API service layer
│   ├── api.js           # Axios configuration
│   ├── auth.js          # Authentication API
│   ├── articles.js      # Articles API
│   ├── feeds.js         # Feeds API
│   └── subscriptions.js # Subscriptions API
├── stores/              # Pinia state management
│   ├── app.js           # App-wide state
│   ├── auth.js          # Authentication state
│   └── feeds.js         # Feeds and subscriptions state
├── views/               # Page components
│   ├── Dashboard.vue    # Main dashboard
│   ├── Feeds.vue        # Browse feeds
│   ├── Login.vue        # Login form
│   ├── Profile.vue      # User profile
│   ├── Register.vue     # Registration form
│   └── Subscriptions.vue # Manage subscriptions
├── App.vue              # Root component
├── main.js              # Application entry point
└── style.css            # Global styles
```

## API Integration

The frontend communicates with the backend Express.js API through:

- **Authentication**: User registration, login, profile management
- **Feeds**: Browse, search, and manage RSS feeds
- **Subscriptions**: Subscribe/unsubscribe from feeds
- **Articles**: Fetch articles and generate summaries

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code with ESLint
- `npm run format` - Format code with Prettier

## Features Overview

### Authentication System
- User registration with validation
- Secure login with JWT tokens
- Profile management and password changes
- OpenAI API key configuration

### Feed Management
- Browse available RSS/Atom feeds
- Search feeds by title and description
- Add custom feeds by URL
- Subscribe/unsubscribe functionality

### Dashboard
- Overview of active subscriptions
- Recent articles from subscribed feeds
- Statistics and quick actions
- Article summary generation

### Responsive Design
- Mobile-first approach with Tailwind CSS
- Clean, modern UI components
- Accessible design with proper ARIA labels
- Dark mode support (planned)

## Development

### Prerequisites
- Node.js 18+ and npm 8+
- Backend API server running on port 3000

### Development Workflow
1. Start the backend server first
2. Run `npm run dev` to start the frontend
3. The development server includes hot reload
4. Proxy configuration routes `/api/*` to backend

### Code Style
- ESLint for code quality
- Prettier for formatting
- Vue 3 Composition API
- TypeScript support (planned)

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style
2. Write meaningful commit messages
3. Test all functionality before submitting
4. Update documentation as needed

## License

MIT License - see LICENSE file for details