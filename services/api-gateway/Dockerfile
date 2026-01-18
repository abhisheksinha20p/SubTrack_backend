FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Run with ts-node-dev for development
EXPOSE 3000
CMD ["npm", "run", "dev"]
