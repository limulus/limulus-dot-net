#!/usr/bin/env node
import { LogicalIdMapper } from '@matthewbonig/cdk-logical-id-mapper'
import * as cdk from 'aws-cdk-lib'
import { AwsSolutionsChecks } from 'cdk-nag'
import esMain from 'es-main'

import { LimulusDotNetStack } from '../lib/limulus-dot-net-stack'

export function createApp(context?: Record<string, any>): cdk.App {
  const app = new cdk.App({ context })

  const branchName =
    app.node.tryGetContext('branchName') || process.env.BRANCH_NAME || 'main'
  const zoneId = app.node.tryGetContext('zoneId') || process.env.LIMULUS_DOT_NET_ZONE_ID
  const certificateArn =
    app.node.tryGetContext('certificateArn') || process.env.LIMULUS_DOT_NET_CERTIFICATE_ARN

  if (!zoneId) {
    throw new Error(
      'Zone ID must be provided via context (zoneId) or environment variable (LIMULUS_DOT_NET_ZONE_ID)'
    )
  }

  if (!certificateArn) {
    throw new Error(
      'Certificate ARN must be provided via context (certificateArn) or environment variable (LIMULUS_DOT_NET_CERTIFICATE_ARN)'
    )
  }

  const stack = new LimulusDotNetStack(app, `limulus-dot-net-${branchName}`, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    branchName,
    zoneId,
    certificateArn,
  })

  // Apply logical ID mapping only for main branch to preserve existing CloudFormation resources
  if (branchName === 'main') {
    cdk.Aspects.of(stack).add(
      new LogicalIdMapper({
        map: {
          StaticSiteBucket8958EE3F: 'StaticSiteBucket',
          CloudFrontDistributionLogsBucketA229EF73: 'CloudFrontDistributionLogsBucket',
          CloudFrontDistributionBA64CE3A: 'CloudFrontDistribution',
        },
      })
    )
  }

  // Apply CDK Nag security checks
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

  return app
}

// Only execute when run directly (not when imported for testing)
if (esMain(import.meta)) {
  createApp()
}
