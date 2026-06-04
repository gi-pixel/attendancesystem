#!/bin/bash

# Create project directory
mkdir -p attendance-qr-system
cd attendance-qr-system

# Create folders
mkdir -p css js api

# Create HTML files
touch index.html professor.html

# Create CSS files
touch css/style.css css/student.css css/professor.css

# Create JS files
touch js/qrcode.min.js js/student.js js/professor.js js/shared.js

# Create API Vercel functions
touch api/generate-qr.js api/mark-attendance.js api/get-session-status.js
touch api/get-attendance.js api/close-session.js

# Create config files
touch config.js vercel.json package.json

# Create .gitignore
echo "google-credentials.json
.env
node_modules/
.DS_Store" > .gitignore

# Create .env template
echo "GOOGLE_SERVICE_ACCOUNT_KEY=''
TELEGRAM_BOT_TOKEN=''
TELEGRAM_CHAT_ID=''" > .env

echo "Project structure created successfully!"
ls -la