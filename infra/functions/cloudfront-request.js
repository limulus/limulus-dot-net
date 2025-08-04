/// <reference types="@types/aws-cloudfront-function" />

/**
 * CloudFront Request Function for limulus.net
 *
 * Handles URL rewrites and redirects for the limulus.net website.
 * This function runs at CloudFront edge locations for low-latency processing.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
 */

/**
 * Regular expressions for URL matching
 * Compiled once for performance
 */
const PENUMBRA_JOURNAL_REDIRECT_RE = /^\/penumbra\/journal\/00[1-5]-/
const MASTODON_PROFILE_REDIRECT_RE = /^\/@eric\/?/
const BLOG_REDIRECT_RE = /^\/blog\/eric\/?$/
const XSD_REWRITE_RE = /^\/xsd\/([^/]+)\/v(\d+)$/
const NEEDS_INDEX_HTML_RE = /(\/[^/.]+)\/*$/

/**
 * Main handler function for CloudFront requests
 *
 * @param {AWSCloudFrontFunction.Event} event - CloudFront event object containing request details
 * @returns {AWSCloudFrontFunction.Request | AWSCloudFrontFunction.Response} Modified request object or redirect response
 */
function handler(event) {
  const request = event.request
  const host = request.headers.host

  // Redirect www.limulus.net to limulus.net
  if (host && host.value === 'www.limulus.net') {
    return createRedirectResponse(
      301,
      'Moved Permanently',
      'https://limulus.net' + request.uri
    )
  }

  // Handle Penumbra journal legacy URLs with numbered prefixes
  // Redirect /penumbra/journal/001-foo to /penumbra/journal/foo
  if (PENUMBRA_JOURNAL_REDIRECT_RE.test(request.uri)) {
    const newUri = request.uri.replace(/00[1-5]-/, '')
    return createRedirectResponse(301, 'Moved Permanently', newUri)
  }

  // Redirect Mastodon profile requests to the actual Mastodon instance
  if (MASTODON_PROFILE_REDIRECT_RE.test(request.uri)) {
    return createRedirectResponse(
      302,
      'Found',
      'https://mastodon.limulus.net' + request.uri
    )
  }

  // Redirect old blog URL to RSS feed
  if (BLOG_REDIRECT_RE.test(request.uri)) {
    return createRedirectResponse(302, 'Found', 'https://limulus.net/feed/')
  }

  // Rewrite XSD version URLs
  // Transform /xsd/tcx/v1 to /xsd/tcx/v1.xsd
  request.uri = request.uri.replace(XSD_REWRITE_RE, '/xsd/$1/v$2.xsd')

  // Add index.html to directory paths (but not for root path)
  if (request.uri !== '/') {
    request.uri = request.uri.replace(NEEDS_INDEX_HTML_RE, '$1/index.html')
  }

  return request
}

/**
 * Helper function to create CloudFront redirect responses
 *
 * @param {number} statusCode - HTTP status code (301, 302, etc.)
 * @param {string} statusDescription - HTTP status description
 * @param {string} location - Redirect target URL
 * @returns {AWSCloudFrontFunction.Response} CloudFront response object
 */
function createRedirectResponse(statusCode, statusDescription, location) {
  return {
    statusCode,
    statusDescription,
    headers: {
      location: {
        value: location,
      },
    },
  }
}

// Make functions available for testing (when not in CloudFront environment)
try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handler, createRedirectResponse }
  }
} catch (_e) {
  // Ignore errors in CloudFront Functions runtime
}
