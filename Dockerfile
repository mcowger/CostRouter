# Dockerfile

# --- Stage 1: Builder ---
# This stage installs all dependencies (including dev) and builds the application.
FROM node:22 AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json files first to leverage Docker's layer caching.
# This step will only be re-run if these files change.
COPY package*.json ./
COPY ui/package.json ./ui/

# Install all dependencies for the entire monorepo
RUN npm install

# Copy the rest of the source code into the container
COPY . .

# Run the unified build script we created.
# This compiles schemas, the server, and the UI in the correct order.
RUN npm run build


# --- Stage 2: Production ---
# This stage creates the final, lean image with only production artifacts.
FROM node:22

WORKDIR /app

# Copy package.json files again to install only production dependencies
COPY package*.json ./
COPY ui/package.json ./ui/
RUN mkdir /config

# Install ONLY production dependencies, skipping all devDependencies.
RUN npm install --omit=dev

# Copy the compiled application code from the 'builder' stage
# This includes the compiled server, UI, and schemas.
COPY --from=builder /app/dist ./dist

# Expose the port the server listens on
EXPOSE 3000

# Create a non-root user and switch to it for better security
RUN addgroup --system --gid 99 nodejs
RUN adduser --system --uid 100 nodejs
RUN chown -R nodejs:nodejs /config
USER nodejs

# The command to run when the container starts.
# It points directly to the compiled server entry point.
# Arguments like --config can be appended to the 'docker run' command.
CMD ["node", "dist/server/index.js","--config-database","/config/config.jsonc"]
