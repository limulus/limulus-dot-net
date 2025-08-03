#!/bin/bash
# CDK synthesis test script
# Verifies CDK compilation and shows CDK Nag security feedback

set -e

echo "🔄 Running CDK synthesis test..."

# Change to project root directory to respect cdk.json configuration
cd "$(dirname "$0")/../.."

# Run CDK synthesis with test context
npx cdk synth \
  --quiet \
  --context branchName=test \
  --context zoneId=Z123 \
  --context certificateArn=arn:aws:acm:us-east-1:123:certificate/test

echo "✅ CDK synthesis completed successfully"