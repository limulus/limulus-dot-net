# CloudFront Functions Integration Tests

This directory contains integration tests that deploy actual CloudFront Functions to AWS and test them using the AWS TestFunction API.

## Purpose

These tests catch runtime issues that unit tests might miss, such as:

- JavaScript syntax compatibility with CloudFront Functions runtime
- Compute utilization and throttling risks
- Function execution errors in the actual AWS environment
- Performance characteristics under realistic conditions

## Prerequisites

- AWS CLI configured with appropriate credentials
- CloudFront API permissions (functions:CreateFunction, functions:TestFunction, etc.)
- Node.js and npm dependencies installed

## Running Integration Tests

```bash
# Run integration tests only
npm run test:integration

# Run with verbose output
npm run test:integration -- --reporter=verbose
```

## Test Coverage

The integration tests cover:

1. **Basic Functionality**: Ensures the function executes without errors
2. **URL Rewrites**: Tests index.html addition and XSD path rewrites
3. **Redirects**: Tests www, Mastodon profile, and Penumbra journal redirects
4. **Compute Utilization**: Validates performance stays under throttling thresholds
5. **Batch Testing**: Tests multiple scenarios to ensure consistent performance

## Compute Utilization Thresholds

Based on AWS documentation and conservative safety margins:

- **1-10%**: Excellent performance, well optimized
- **11-50%**: Safe, no throttling risk
- **51-70%**: Approaching limits, consider optimization
- **71-100%**: High risk of throttling
- **Test Thresholds**: 
  - Individual tests: < 15% (conservative safety margin)
  - Average across all tests: < 10% (optimal performance target)

## Test Function Lifecycle

Each test run:

1. Creates a temporary CloudFront Function (`limulus-dot-net-integration-test`) using JavaScript runtime 2.0
2. Runs all test scenarios using the TestFunction API
3. Cleans up by deleting the temporary function

## Output

Tests provide detailed output including:

- Compute utilization for each test case
- Function execution logs
- Error messages (if any)
- Performance analysis across different URL patterns

## Troubleshooting

If tests fail:

1. Check AWS credentials and permissions
2. Verify CloudFront Functions quota limits
3. Review compute utilization scores in test output
4. Check CloudWatch metrics for the test function
