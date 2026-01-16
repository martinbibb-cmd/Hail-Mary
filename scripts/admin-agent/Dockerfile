FROM docker:28-cli AS docker-cli
FROM node:20-alpine

# Copy docker CLI from official docker image
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

# Create directory for docker CLI plugins
RUN mkdir -p /usr/local/libexec/docker/cli-plugins

WORKDIR /app

# Copy admin agent files
COPY package.json server.js ./

# Expose port
EXPOSE 4010

# Run the server
CMD ["node", "server.js"]
