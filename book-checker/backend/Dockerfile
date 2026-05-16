FROM node:18-alpine

WORKDIR /app

# Copy package files for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Ensure data directories exist
RUN mkdir -p ../custom-lists ../saved-searches ../public/book-covers

EXPOSE 3001

CMD ["npm", "start"]
