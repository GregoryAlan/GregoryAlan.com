#!/bin/bash
set -euo pipefail

# Load project env vars
if [ -f .env ]; then
  set -a; source .env; set +a
fi
: "${CLOUDFRONT_DISTRIBUTION_ID:?Set CLOUDFRONT_DISTRIBUTION_ID in .env}"

# Build the curl-accessible filesystem
node build-curl.js

# ── Sync 1: Main site ────────────────────────────────────────
#
# --delete removes stale main-site files from S3, but we must exclude
# all VFS paths that Syncs 2-3 upload from curl-out/. Without these
# exclusions, --delete would remove VFS files on subsequent deploys
# because they don't exist in the project root.

aws s3 sync "/Users/greg/Projects/GregoryAlan.com/" s3://gregoryalan.com \
    --exclude ".DS_Store" --exclude "*/.DS_Store" \
    --exclude "deploy.sh" --exclude "build-curl.js" \
    --exclude ".git/*" --exclude ".gitignore" \
    --exclude ".claude/*" --exclude "*/.claude/*" \
    --exclude "*.md" \
    --exclude "curl-out/*" --exclude "node_modules/*" \
    --exclude "lore/*" --exclude "drafts/*" \
    --exclude "dev/*" --exclude "etc/*" --exclude "home/*" \
    --exclude "man/*" --exclude "pkg/*" --exclude "proc/*" \
    --exclude "rom/*" --exclude "sys/*" --exclude "var/*" \
    --exclude "help" --exclude "motd" \
    --exclude "status" --exclude "status.json" \
    --exclude ".rf0.buf" --exclude "llms.txt" --exclude "llms-full.txt" \
    --exclude ".well-known/*" \
    --delete

# ── Sync 2: VFS text files (text/plain) ──────────────────────

aws s3 sync "curl-out/" s3://gregoryalan.com/ \
    --content-type "text/plain; charset=utf-8" \
    --exclude "*.json"

# ── Sync 3: VFS JSON files (application/json) ────────────────

aws s3 sync "curl-out/" s3://gregoryalan.com/ \
    --content-type "application/json" \
    --exclude "*" --include "*.json"

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
