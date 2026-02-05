#!/bin/bash

# Deploy to S3 and clear CloudFront cache
aws s3 sync "/Users/greg/Projects/GregoryAlan.com/" s3://gregoryalan.com --exclude ".DS_Store" --exclude "deploy.sh" --delete && \
aws cloudfront create-invalidation --distribution-id E1TSLTPSW9N88B --paths "/*"
