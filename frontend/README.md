# React Frontend

Modern React UI for Project Failure Predictor using Vite.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Development server with hot reload:
```bash
npm run dev
```

The dev server will start at `http://localhost:5173` and proxy API calls to `http://localhost:8000`.

3. Build for production:
```bash
npm run build
```

This builds the React app to `../predictor/static/dist` where Django can serve it.

## Structure

- `src/App.jsx` - Main app component
- `src/components/` - React components (Hero, Dashboard, etc.)
- `src/index.css` - Global styles
- `vite.config.js` - Vite configuration with Django proxy

## Integration with Django

After building (`npm run build`), Django serves the built React app from the `/` route.
