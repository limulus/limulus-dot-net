/**
 * CloudFront Function Integration Tests
 *
 * These tests deploy the actual CloudFront Function to AWS and test it using
 * the TestFunction API to catch runtime issues that unit tests might miss.
 */

import {
  CloudFrontClient,
  CreateFunctionCommand,
  UpdateFunctionCommand,
  TestFunctionCommand,
  DeleteFunctionCommand,
  DescribeFunctionCommand,
} from '@aws-sdk/client-cloudfront'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const FUNCTION_NAME = 'limulus-dot-net-integration-test'
const FUNCTION_COMMENT = 'Integration test function - safe to delete'

describe('CloudFront Function Integration Tests', () => {
  let cloudfront: CloudFrontClient
  let functionETag: string | undefined

  beforeAll(async () => {
    cloudfront = new CloudFrontClient({ region: 'us-east-1' }) // CloudFront Functions are global but API is in us-east-1

    // Read the function code
    const functionCode = readFileSync(
      resolve(__dirname, '../../functions/cloudfront-request.js'),
      'utf8'
    )

    try {
      // Try to create the function
      const createResponse = await cloudfront.send(
        new CreateFunctionCommand({
          Name: FUNCTION_NAME,
          FunctionCode: Buffer.from(functionCode),
          FunctionConfig: {
            Comment: FUNCTION_COMMENT,
            Runtime: 'cloudfront-js-2.0',
          },
        })
      )
      functionETag = createResponse.ETag
    } catch (error: any) {
      if (error.name === 'FunctionAlreadyExists') {
        // Function exists, update it instead
        const updateResponse = await cloudfront.send(
          new UpdateFunctionCommand({
            Name: FUNCTION_NAME,
            FunctionCode: Buffer.from(functionCode),
            FunctionConfig: {
              Comment: FUNCTION_COMMENT,
              Runtime: 'cloudfront-js-2.0',
            },
            IfMatch: await getFunctionETag(),
          })
        )
        functionETag = updateResponse.ETag
      } else {
        throw error
      }
    }
  })

  afterAll(async () => {
    // Clean up the test function
    if (functionETag) {
      try {
        await cloudfront.send(
          new DeleteFunctionCommand({
            Name: FUNCTION_NAME,
            IfMatch: functionETag,
          })
        )
      } catch (error) {
        console.warn('Failed to clean up test function:', error)
      }
    }
  })

  async function getFunctionETag(): Promise<string> {
    const response = await cloudfront.send(
      new DescribeFunctionCommand({
        Name: FUNCTION_NAME,
        Stage: 'DEVELOPMENT',
      })
    )
    return response.ETag!
  }

  async function testFunction(eventObject: any) {
    if (!functionETag) {
      throw new Error('Function not created')
    }

    const response = await cloudfront.send(
      new TestFunctionCommand({
        Name: FUNCTION_NAME,
        IfMatch: functionETag,
        EventObject: Buffer.from(JSON.stringify(eventObject)),
        Stage: 'DEVELOPMENT',
      })
    )

    return {
      computeUtilization: parseInt(response.TestResult?.ComputeUtilization ?? '0', 10),
      functionOutput: response.TestResult?.FunctionOutput
        ? JSON.parse(response.TestResult.FunctionOutput)
        : null,
      functionErrorMessage: response.TestResult?.FunctionErrorMessage,
      functionExecutionLogs: response.TestResult?.FunctionExecutionLogs ?? [],
    }
  }

  it('should execute without errors for basic request', async () => {
    const eventObject = {
      version: '1.0',
      context: { eventType: 'viewer-request' },
      viewer: { ip: '192.0.2.1' },
      request: {
        method: 'GET',
        uri: '/',
        headers: { host: { value: 'limulus.net' } },
        cookies: {},
        querystring: {},
      },
    }

    const result = await testFunction(eventObject)

    expect(result.functionErrorMessage).toBeFalsy()
    expect(result.computeUtilization).toBeLessThan(15) // Conservative threshold well under CloudFront limits
    expect(result.functionOutput).toBeTruthy()
    expect(result.functionOutput.request.uri).toBe('/') // Root path should remain unchanged (CloudFront handles default root object)
  })

  it('should handle www redirect with acceptable compute utilization', async () => {
    const eventObject = {
      version: '1.0',
      context: { eventType: 'viewer-request' },
      viewer: { ip: '192.0.2.1' },
      request: {
        method: 'GET',
        uri: '/some-path',
        headers: { host: { value: 'www.limulus.net' } },
        cookies: {},
        querystring: {},
      },
    }

    const result = await testFunction(eventObject)

    expect(result.functionErrorMessage).toBeFalsy()
    expect(result.computeUtilization).toBeLessThan(15)
    expect(result.functionOutput.response.statusCode).toBe(301)
    expect(result.functionOutput.response.headers.location.value).toBe(
      'https://limulus.net/some-path'
    )
  })

  it('should handle penumbra journal redirect', async () => {
    const eventObject = {
      version: '1.0',
      context: { eventType: 'viewer-request' },
      viewer: { ip: '192.0.2.1' },
      request: {
        method: 'GET',
        uri: '/penumbra/journal/001-some-post',
        headers: { host: { value: 'limulus.net' } },
        cookies: {},
        querystring: {},
      },
    }

    const result = await testFunction(eventObject)

    expect(result.functionErrorMessage).toBeFalsy()
    expect(result.computeUtilization).toBeLessThan(15)
    expect(result.functionOutput.response.statusCode).toBe(301)
    expect(result.functionOutput.response.headers.location.value).toBe(
      '/penumbra/journal/some-post'
    )
  })

  it('should handle mastodon profile redirect', async () => {
    const eventObject = {
      version: '1.0',
      context: { eventType: 'viewer-request' },
      viewer: { ip: '192.0.2.1' },
      request: {
        method: 'GET',
        uri: '/@eric',
        headers: { host: { value: 'limulus.net' } },
        cookies: {},
        querystring: {},
      },
    }

    const result = await testFunction(eventObject)

    expect(result.functionErrorMessage).toBeFalsy()
    expect(result.computeUtilization).toBeLessThan(15)
    expect(result.functionOutput.response.statusCode).toBe(302)
    expect(result.functionOutput.response.headers.location.value).toBe(
      'https://mastodon.limulus.net/@eric'
    )
  })

  it('should handle XSD rewrite', async () => {
    const eventObject = {
      version: '1.0',
      context: { eventType: 'viewer-request' },
      viewer: { ip: '192.0.2.1' },
      request: {
        method: 'GET',
        uri: '/xsd/tcx/v1',
        headers: { host: { value: 'limulus.net' } },
        cookies: {},
        querystring: {},
      },
    }

    const result = await testFunction(eventObject)

    expect(result.functionErrorMessage).toBeFalsy()
    expect(result.computeUtilization).toBeLessThan(15)
    expect(result.functionOutput.request.uri).toBe('/xsd/tcx/v1.xsd')
  })

  it('should maintain low compute utilization across all test cases', async () => {
    const testCases = [
      { uri: '/', host: 'limulus.net' },
      { uri: '/some/deep/path', host: 'limulus.net' },
      { uri: '/blog/eric/', host: 'limulus.net' },
      { uri: '/penumbra/journal/002-another-post', host: 'limulus.net' },
      { uri: '/@eric/', host: 'limulus.net' },
      { uri: '/xsd/gpx/v2', host: 'limulus.net' },
      { uri: '/favicon.ico', host: 'www.limulus.net' },
    ]

    const results = []

    for (const testCase of testCases) {
      const eventObject = {
        version: '1.0',
        context: { eventType: 'viewer-request' },
        viewer: { ip: '192.0.2.1' },
        request: {
          method: 'GET',
          uri: testCase.uri,
          headers: { host: { value: testCase.host } },
          cookies: {},
          querystring: {},
        },
      }

      const result = await testFunction(eventObject)
      results.push({
        uri: testCase.uri,
        host: testCase.host,
        computeUtilization: result.computeUtilization,
        hasError: !!result.functionErrorMessage,
      })

      // Each individual test should pass
      expect(result.functionErrorMessage).toBeFalsy()
      expect(result.computeUtilization).toBeLessThan(15)
    }

    // Log results for analysis
    console.log('Compute utilization results:')
    console.table(results)

    // Ensure average utilization is reasonable
    const avgUtilization =
      results.reduce((sum, r) => sum + r.computeUtilization, 0) / results.length
    expect(avgUtilization).toBeLessThan(10) // Conservative average threshold
  })
})
