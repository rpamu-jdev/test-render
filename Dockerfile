# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Final stage
FROM node:20-alpine
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app .

EXPOSE 3000
CMD ["node", "server.js"]