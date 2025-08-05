import { LogicalIdMapper } from '@matthewbonig/cdk-logical-id-mapper'
import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { describe, test, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../bin/app'

describe('App deployment logic', () => {
  // Store original environment variables
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Set required environment variables for tests
    process.env.LIMULUS_DOT_NET_ZONE_ID = 'Z123456789ABCDEFGH'
    process.env.LIMULUS_DOT_NET_CERTIFICATE_ARN =
      'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id'
  })

  afterEach(() => {
    // Restore original environment variables
    Object.keys(process.env).forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    })
  })

  describe('Logical ID mapping', () => {
    test('main branch applies logical ID mapping for production resources', () => {
      const app = createApp({
        branchName: 'main',
        zoneId: 'Z123456789ABCDEFGH',
        certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
      })

      // The app should automatically apply logical ID mapping for main branch
      const stack = app.node.findChild('limulus-dot-net-main') as cdk.Stack
      expect(stack).toBeDefined()

      // Check if LogicalIdMapper aspect was applied
      const aspects = cdk.Aspects.of(stack).all
      const hasLogicalIdMapper = aspects.some((aspect) => aspect instanceof LogicalIdMapper)
      expect(hasLogicalIdMapper).toBe(true)

      const template = Template.fromStack(stack)
      const resources = template.toJSON().Resources

      // Verify mapped logical IDs are present for critical production resources
      expect(resources).toHaveProperty('StaticSiteBucket')
      expect(resources).toHaveProperty('CloudFrontDistributionLogsBucket')
      expect(resources).toHaveProperty('CloudFrontDistribution')

      // Verify auto-generated IDs are NOT present
      expect(resources).not.toHaveProperty('StaticSiteBucket8958EE3F')
      expect(resources).not.toHaveProperty('CloudFrontDistributionLogsBucketA229EF73')
      expect(resources).not.toHaveProperty('CloudFrontDistributionBA64CE3A')
    })

    test('feature branch does NOT apply logical ID mapping', () => {
      const app = createApp({
        branchName: 'feature',
        zoneId: 'Z123456789ABCDEFGH',
        certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
      })

      const stack = app.node.findChild('limulus-dot-net-feature') as cdk.Stack
      expect(stack).toBeDefined()

      // Check that NO LogicalIdMapper aspect was applied
      const aspects = cdk.Aspects.of(stack).all
      const hasLogicalIdMapper = aspects.some((aspect) => aspect instanceof LogicalIdMapper)
      expect(hasLogicalIdMapper).toBe(false)

      const template = Template.fromStack(stack)
      const resources = template.toJSON().Resources

      // Should NOT have the mapped logical IDs
      expect(resources).not.toHaveProperty('StaticSiteBucket')
      expect(resources).not.toHaveProperty('CloudFrontDistributionLogsBucket')
      expect(resources).not.toHaveProperty('CloudFrontDistribution')
    })
  })

  describe('Branch-specific configuration', () => {
    test('main branch creates production domain configuration', () => {
      const app = createApp({
        branchName: 'main',
        zoneId: 'Z123456789ABCDEFGH',
        certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
      })

      const stack = app.node.findChild('limulus-dot-net-main') as cdk.Stack
      const template = Template.fromStack(stack)

      // Check CloudFront distribution has production domains
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: ['limulus.net', 'www.limulus.net'],
        },
      })

      // Check Route53 RecordSetGroup for production domains
      template.hasResourceProperties('AWS::Route53::RecordSetGroup', {
        RecordSets: [
          {
            Name: 'limulus.net',
            Type: 'A',
          },
          {
            Name: 'limulus.net',
            Type: 'AAAA',
          },
          {
            Name: 'www.limulus.net',
            Type: 'A',
          },
          {
            Name: 'www.limulus.net',
            Type: 'AAAA',
          },
        ],
      })
    })

    test('feature branch creates branch-specific domain configuration', () => {
      const app = createApp({
        branchName: 'feature',
        zoneId: 'Z123456789ABCDEFGH',
        certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
      })

      const stack = app.node.findChild('limulus-dot-net-feature') as cdk.Stack
      const template = Template.fromStack(stack)

      // Check CloudFront distribution has feature branch domain
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: ['feature.limulus.net'],
        },
      })

      // Check Route53 RecordSetGroup for feature branch domain
      template.hasResourceProperties('AWS::Route53::RecordSetGroup', {
        RecordSets: [
          {
            Name: 'feature.limulus.net',
            Type: 'A',
          },
          {
            Name: 'feature.limulus.net',
            Type: 'AAAA',
          },
        ],
      })
    })
  })
})
