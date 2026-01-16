FROM docker:28-cli AS docker-cli
FROM node:20-alpine

# Create directory for docker CLI plugins first
RUN mkdir -p /usr/local/libexec/docker/cli-plugins

# Copy docker CLI from official docker image
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

WORKDIR /app

# Copy admin agent files
COPY package.json server.js ./

# Expose port
EXPOSE 4010

# Run the server
CMD ["node", "server.js"]
