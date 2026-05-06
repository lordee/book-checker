#!/bin/sh

echo "Starting Book Checker add-on..."

# Define directories that need to be persistent
DIRS="public/book-covers custom-lists saved-searches"

for dir in $DIRS; do
    # Create the directory in the persistent /data volume if it doesn't exist
    mkdir -p /data/$dir
    
    # If the directory exists in the app but is not a symlink, move its contents to /data
    if [ -d /app/$dir ] && [ ! -L /app/$dir ]; then
        cp -rn /app/$dir/* /data/$dir/ 2>/dev/null || true
        rm -rf /app/$dir
    fi
    
    # Create symlink from /app to /data
    ln -sf /data/$dir /app/$dir
    
    # Ensure correct permissions
    chown -R nextjs:nodejs /data/$dir
done

# Handle library-config.md specifically
if [ ! -f /data/library-config.md ]; then
    if [ -f /app/library-config.md ]; then
        cp /app/library-config.md /data/library-config.md
    else
        touch /data/library-config.md
    fi
fi
rm -f /app/library-config.md
ln -sf /data/library-config.md /app/library-config.md
chown nextjs:nodejs /data/library-config.md

# Switch to nextjs user and start the server
exec su-exec nextjs node server.js
