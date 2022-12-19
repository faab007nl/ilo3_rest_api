ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN \
  apk add --no-cache \
    python3

# Python 3 HTTP Server serves the current working dir
# So let's set it to our add-on persistent data directory.
WORKDIR /app

# Setup API

# Install nodejs
RUN yum -y install nodejs npm

# Copy files
COPY app /app

# Expose port
EXPOSE 4323

# Install npm dependencies
RUN npm install