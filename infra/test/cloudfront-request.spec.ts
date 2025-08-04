/**
 * Tests for CloudFront Request Function
 *
 * Comprehensive test suite covering all URL rewrite and redirect scenarios
 */

/// <reference types="@types/aws-cloudfront-function" />
/* eslint-disable no-var */
/* eslint-disable no-eval */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

// Load the CloudFront function using module.exports
const cfFunctionCode = readFileSync(
  resolve(__dirname, '../functions/cloudfront-request.js'),
  'utf8'
)

// Create a module context for the function to export to
const moduleContext = { exports: {} as any }
const wrappedCode = `
  (function(module) {
    ${cfFunctionCode}
    return module.exports;
  })
`
const cfExports = eval(wrappedCode)(moduleContext)
const { handler, createRedirectResponse } = cfExports

/**
 * Helper function to create test CloudFront events
 */
function createTestEvent(uri: string, host = 'limulus.net'): AWSCloudFrontFunction.Event {
  return {
    version: '1.0',
    context: {
      distributionDomainName: 'example.cloudfront.net',
      distributionId: 'EXAMPLE123',
      eventType: 'viewer-request',
      requestId: 'example-request-id',
    },
    viewer: {
      ip: '192.0.2.1',
    },
    request: {
      method: 'GET',
      uri,
      querystring: {},
      headers: {
        host: {
          value: host,
        },
      },
      cookies: {},
    },
    response: {
      statusCode: 200,
      statusDescription: 'OK',
      headers: {},
      cookies: {},
    },
  }
}

/**
 * Helper function to check if result is a redirect response
 */
function isRedirectResponse(
  result: AWSCloudFrontFunction.Request | AWSCloudFrontFunction.Response
): result is AWSCloudFrontFunction.Response {
  return 'statusCode' in result
}

/**
 * Helper function to check if result is a modified request
 */
function isModifiedRequest(
  result: AWSCloudFrontFunction.Request | AWSCloudFrontFunction.Response
): result is AWSCloudFrontFunction.Request {
  return 'uri' in result && !('statusCode' in result)
}

describe('CloudFront Request Function', () => {
  describe('WWW redirect', () => {
    it('should redirect www.limulus.net to limulus.net', () => {
      const event = createTestEvent('/test-page', 'www.limulus.net')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(301)
        expect(result.statusDescription).toBe('Moved Permanently')
        expect(result.headers!.location!.value).toBe('https://limulus.net/test-page')
      }
    })

    it('should redirect www.limulus.net root to limulus.net root', () => {
      const event = createTestEvent('/', 'www.limulus.net')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(301)
        expect(result.headers!.location!.value).toBe('https://limulus.net/')
      }
    })

    it('should not redirect limulus.net (no www)', () => {
      const event = createTestEvent('/test-page', 'limulus.net')
      const result = handler(event)

      expect(isModifiedRequest(result)).toBe(true)
    })
  })

  describe('Penumbra journal redirects', () => {
    it('should redirect numbered journal entries (001)', () => {
      const event = createTestEvent('/penumbra/journal/001-first-entry')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(301)
        expect(result.statusDescription).toBe('Moved Permanently')
        expect(result.headers!.location!.value).toBe('/penumbra/journal/first-entry')
      }
    })

    it('should redirect numbered journal entries (002-005)', () => {
      const testCases = [
        {
          input: '/penumbra/journal/002-second-entry',
          expected: '/penumbra/journal/second-entry',
        },
        {
          input: '/penumbra/journal/003-third-entry',
          expected: '/penumbra/journal/third-entry',
        },
        {
          input: '/penumbra/journal/004-fourth-entry',
          expected: '/penumbra/journal/fourth-entry',
        },
        {
          input: '/penumbra/journal/005-fifth-entry',
          expected: '/penumbra/journal/fifth-entry',
        },
      ]

      testCases.forEach(({ input, expected }) => {
        const event = createTestEvent(input)
        const result = handler(event)

        expect(isRedirectResponse(result)).toBe(true)
        if (isRedirectResponse(result)) {
          expect(result.statusCode).toBe(301)
          expect(result.headers!.location!.value).toBe(expected)
        }
      })
    })

    it('should not redirect journal entries without numbered prefixes', () => {
      const event = createTestEvent('/penumbra/journal/normal-entry')
      const result = handler(event)

      expect(isModifiedRequest(result)).toBe(true)
    })

    it('should not redirect numbered entries outside 001-005 range', () => {
      const testCases = [
        '/penumbra/journal/006-should-not-redirect',
        '/penumbra/journal/000-should-not-redirect',
      ]

      testCases.forEach((uri) => {
        const event = createTestEvent(uri)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
      })
    })
  })

  describe('Mastodon profile redirects', () => {
    it('should redirect /@eric to Mastodon instance', () => {
      const event = createTestEvent('/@eric')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(302)
        expect(result.statusDescription).toBe('Found')
        expect(result.headers!.location!.value).toBe('https://mastodon.limulus.net/@eric')
      }
    })

    it('should redirect /@eric/ (with trailing slash) to Mastodon instance', () => {
      const event = createTestEvent('/@eric/')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(302)
        expect(result.headers!.location!.value).toBe('https://mastodon.limulus.net/@eric/')
      }
    })

    it('should redirect /@eric sub-paths to Mastodon instance', () => {
      const testCases = [
        '/@eric/posts/123',
        '/@eric/followers',
        '/@eric/following',
        '/@eric/with/multiple/segments',
      ]

      testCases.forEach((uri) => {
        const event = createTestEvent(uri)
        const result = handler(event)

        expect(isRedirectResponse(result)).toBe(true)
        if (isRedirectResponse(result)) {
          expect(result.statusCode).toBe(302)
          expect(result.statusDescription).toBe('Found')
          expect(result.headers!.location!.value).toBe('https://mastodon.limulus.net' + uri)
        }
      })
    })

    it('should not redirect other @ usernames', () => {
      const event = createTestEvent('/@other-user')
      const result = handler(event)

      expect(isModifiedRequest(result)).toBe(true)
    })
  })

  describe('Blog redirects', () => {
    it('should redirect /blog/eric to /feed', () => {
      const event = createTestEvent('/blog/eric')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(302)
        expect(result.statusDescription).toBe('Found')
        expect(result.headers!.location!.value).toBe('https://limulus.net/feed/')
      }
    })

    it('should redirect /blog/eric/ (with trailing slash) to /feed', () => {
      const event = createTestEvent('/blog/eric/')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(302)
        expect(result.headers!.location!.value).toBe('https://limulus.net/feed/')
      }
    })

    it('should not redirect other blog paths', () => {
      const testCases = ['/blog', '/blog/', '/blog/other-author']

      testCases.forEach((uri) => {
        const event = createTestEvent(uri)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
      })
    })
  })

  describe('XSD URL rewrites', () => {
    it('should rewrite XSD version URLs to include .xsd extension', () => {
      const testCases = [
        { input: '/xsd/tcx/v1', expected: '/xsd/tcx/v1.xsd' },
        { input: '/xsd/gpx/v2', expected: '/xsd/gpx/v2.xsd' },
        { input: '/xsd/kml/v22', expected: '/xsd/kml/v22.xsd' },
      ]

      testCases.forEach(({ input, expected }) => {
        const event = createTestEvent(input)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
        if (isModifiedRequest(result)) {
          expect(result.uri).toBe(expected)
        }
      })
    })

    it('should not rewrite non-XSD URLs', () => {
      const testCases = [
        '/api/v1',
        '/other/path',
        '/xsd/tcx', // Missing version part
      ]

      testCases.forEach((uri) => {
        const event = createTestEvent(uri)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
        if (isModifiedRequest(result)) {
          // Should only have index.html rewrite applied
          expect(result.uri).toBe(uri + '/index.html')
        }
      })
    })
  })

  describe('Index.html rewrites', () => {
    it('should add index.html to directory paths', () => {
      const testCases = [
        { input: '/about', expected: '/about/index.html' },
        { input: '/about/', expected: '/about/index.html' },
        { input: '/deeply/nested/path', expected: '/deeply/nested/path/index.html' },
        { input: '/deeply/nested/path/', expected: '/deeply/nested/path/index.html' },
      ]

      testCases.forEach(({ input, expected }) => {
        const event = createTestEvent(input)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
        if (isModifiedRequest(result)) {
          expect(result.uri).toBe(expected)
        }
      })
    })

    it('should not modify file paths with extensions', () => {
      const testCases = ['/style.css', '/script.js', '/document.pdf', '/foo/bar.txt']

      testCases.forEach((uri) => {
        const event = createTestEvent(uri)
        const result = handler(event)

        expect(isModifiedRequest(result)).toBe(true)
        if (isModifiedRequest(result)) {
          // File paths with extensions should be left unchanged
          expect(result.uri).toBe(uri)
        }
      })
    })

    it('should not modify root path (handled by CloudFront default root object)', () => {
      const event = createTestEvent('/')
      const result = handler(event)

      expect(isModifiedRequest(result)).toBe(true)
      if (isModifiedRequest(result)) {
        expect(result.uri).toBe('/')
      }
    })
  })

  describe('createRedirectResponse helper', () => {
    it('should create valid redirect response', () => {
      const response = createRedirectResponse(
        301,
        'Moved Permanently',
        'https://example.com'
      )

      expect(response.statusCode).toBe(301)
      expect(response.statusDescription).toBe('Moved Permanently')
      expect(response.headers!.location!.value).toBe('https://example.com')
    })

    it('should handle different status codes', () => {
      const testCases = [
        { code: 301, description: 'Moved Permanently' },
        { code: 302, description: 'Found' },
        { code: 307, description: 'Temporary Redirect' },
        { code: 308, description: 'Permanent Redirect' },
      ]

      testCases.forEach(({ code, description }) => {
        const response = createRedirectResponse(code, description, 'https://example.com')
        expect(response.statusCode).toBe(code)
        expect(response.statusDescription).toBe(description)
      })
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple transformations in order', () => {
      // XSD rewrite should happen before index.html addition
      const event = createTestEvent('/xsd/tcx/v1')
      const result = handler(event)

      expect(isModifiedRequest(result)).toBe(true)
      if (isModifiedRequest(result)) {
        expect(result.uri).toBe('/xsd/tcx/v1.xsd')
      }
    })

    it('should prioritize redirects over rewrites', () => {
      // WWW redirect should happen before any rewriting
      const event = createTestEvent('/xsd/tcx/v1', 'www.limulus.net')
      const result = handler(event)

      expect(isRedirectResponse(result)).toBe(true)
      if (isRedirectResponse(result)) {
        expect(result.statusCode).toBe(301)
        expect(result.headers!.location!.value).toBe('https://limulus.net/xsd/tcx/v1')
      }
    })
  })
})
