# Node.js 24 base image
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Final stage for production
FROM node:24-alpine AS production
WORKDIR /app
COPY --from=0 /app/node_modules ./node_modules
COPY --from=0 /app/dist ./dist
COPY --from=0 /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "run", "start:prod"]
