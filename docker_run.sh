#!/bin/bash

set -e

if [ ! -f ".env" ]; then
  echo "❌ ERROR: .env file not found!"
  echo "Please create a .env file with your environment variables."
  exit 1
fi

echo "Starting metro-navix-backend container..."

docker run -d \
  --env-file .env \
  -p 3000:3000 \
  --name metro-navix-backend \
  metro-navix-backend:0.1-SNAPSHOT

echo "Container started!"
echo "Access your backend at: http://localhost:3000"
