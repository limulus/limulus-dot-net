import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { describe, test, expect } from 'vitest'

import { LimulusDotNetStack } from '../lib/limulus-dot-net-stack.ts'

describe('LimulusDotNetStack', () => {
  const defaultProps = {
    zoneId: 'Z123456789ABCDEFGH',
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert-id',
  }

  test('main branch creates expected resources', () => {
    const app = new cdk.App()
    const stack = new LimulusDotNetStack(app, 'TestStack', {
      ...defaultProps,
      branchName: 'main',
    })

    const template = Template.fromStack(stack)
    expect(template.toJSON()).toMatchSnapshot()
  })

  test('feature branch creates expected resources', () => {
    const app = new cdk.App()
    const stack = new LimulusDotNetStack(app, 'TestStack', {
      ...defaultProps,
      branchName: 'cdk',
    })

    const template = Template.fromStack(stack)
    expect(template.toJSON()).toMatchSnapshot()
  })

  test('stack has required outputs', () => {
    const app = new cdk.App()
    const stack = new LimulusDotNetStack(app, 'TestStack', {
      ...defaultProps,
      branchName: 'test',
    })

    const template = Template.fromStack(stack)

    // Verify outputs exist
    template.hasOutput('StaticSiteBucketName', {})
    template.hasOutput('CloudFrontDistributionLogsBucketName', {})
    template.hasOutput('LogProcessingSqsQueueArn', {})
  })
})
