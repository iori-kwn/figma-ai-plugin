#!/bin/bash

# Figma Plugin Deployment Script

echo "🚀 Starting Figma plugin deployment process..."

# Step 1: Build TypeScript files
echo "Building TypeScript files..."
npm run build

# Step 2: Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Step 3: Deploy to Vercel if requested
if [ "$1" == "--deploy" ] || [ "$2" == "--deploy" ]; then
  echo "Deploying to Vercel..."
  vercel --prod
fi

# Step 4: Remind about API key configuration
echo "✅ Deployment process complete!"
echo ""
echo "Remember to:"
echo "1. Make sure your manifest.json has the correct 'allowedDomains' entries"
echo "2. Ensure your proxy URL in code.ts matches your Vercel deployment"
echo "3. Set your Claude API key in the plugin settings when using it"
echo ""
echo "To test the plugin, load it in Figma Developer mode." 