import * as cdk from 'aws-cdk-lib'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { NagSuppressions } from 'cdk-nag'
import { Construct } from 'constructs'

export interface LimulusDotNetStackProps extends cdk.StackProps {
  branchName: string
  zoneId: string
  certificateArn: string
}

export class LimulusDotNetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LimulusDotNetStackProps) {
    super(scope, id, props)

    const { branchName, zoneId, certificateArn } = props
    const isMainBranch = branchName === 'main'

    // S3 Bucket for static site content
    const staticSiteBucket = new s3.Bucket(this, 'StaticSiteBucket', {
      bucketName: undefined, // Let CDK generate the name
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    })

    NagSuppressions.addResourceSuppressions(staticSiteBucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Access logging not required for static website content bucket',
      },
    ])

    // S3 Bucket for CloudFront distribution logs
    const cloudFrontLogsBucket = new s3.Bucket(this, 'CloudFrontDistributionLogsBucket', {
      bucketName: undefined, // Let CDK generate the name
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'MoveToInfrequentAccess',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })

    NagSuppressions.addResourceSuppressions(cloudFrontLogsBucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Overkill for static site',
      },
    ])

    // SQS Queues for log processing
    const logProcessingDeadLetterQueue = new sqs.Queue(
      this,
      'LogProcessingSqsDeadLetterQueue',
      {
        queueName: `limulus-dot-net-log-processing-dlq-${branchName}`,
        retentionPeriod: cdk.Duration.days(14),
        enforceSSL: true,
      }
    )

    const logProcessingQueue = new sqs.Queue(this, 'LogProcessingSqsQueue', {
      queueName: `limulus-dot-net-log-processing-${branchName}`,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.minutes(5),
      enforceSSL: true,
      deadLetterQueue: {
        queue: logProcessingDeadLetterQueue,
        maxReceiveCount: 3,
      },
    })

    // S3 notification to SQS for log processing
    cloudFrontLogsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(logProcessingQueue),
      { prefix: 'limulus-dot-net/' }
    )

    // Suppress CDK Nag warnings for auto-generated S3 notification Lambda
    // This Lambda is created automatically by CDK for S3->SQS notifications
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'AWS managed policy AWSLambdaBasicExecutionRole is appropriate for auto-generated S3 notification handler',
        appliesTo: [
          'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Wildcard permissions are required for auto-generated S3 notification handler to access CloudWatch logs',
        appliesTo: ['Resource::*'],
      },
    ])

    // CloudFront Cache Policies
    const defaultCachePolicy = new cloudfront.CachePolicy(
      this,
      'CloudFrontDistributionDefaultCachePolicy',
      {
        cachePolicyName: `limulus-dot-net-cache-${branchName}`,
        comment: 'Default cache policy for limulus.net',
        defaultTtl: cdk.Duration.minutes(1),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.seconds(0),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      }
    )

    const foreverCachePolicy = new cloudfront.CachePolicy(
      this,
      'CloudFrontDistributionForeverCachePolicy',
      {
        cachePolicyName: `limulus-dot-net-forever-cache-${branchName}`,
        comment: 'Cache policy for immutable assets',
        defaultTtl: cdk.Duration.days(365),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.days(365),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      }
    )

    // CloudFront Response Headers Policies
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'CloudFrontResponseHeadersPolicy',
      {
        responseHeadersPolicyName: `limulus-dot-net-response-headers-${branchName}`,
        comment: 'Add headers to allow fine grained timers in JS runtime',
        customHeadersBehavior: {
          customHeaders: [
            { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: false },
            {
              header: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
              override: false,
            },
          ],
        },
      }
    )

    const immutableResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'CloudFrontImmutableResponseHeadersPolicy',
      {
        responseHeadersPolicyName: `limulus-dot-net-immutable-response-headers-${branchName}`,
        comment: 'Add headers to cache resources forever',
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
              override: true,
            },
            { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: false },
            {
              header: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
              override: false,
            },
          ],
        },
      }
    )

    // CloudFront Function for URL rewrites and redirects
    const requestFunction = new cloudfront.Function(this, 'CloudFrontRequestFunction', {
      functionName: `limulus-dot-net-rewrite-${branchName}`,
      comment: 'Default request handler - JavaScript with JSDoc types',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromFile({
        filePath: './infra/functions/cloudfront-request.js',
      }),
    })

    // Origin Access Control for S3 (replaces deprecated OAI)
    const originAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      'StaticSiteOAC',
      {
        description: 'Origin Access Control for static site bucket',
      }
    )

    // CloudFront Distribution (moved up to reference in bucket policy)
    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      comment: `limulus-dot-net ${branchName}`,
      defaultRootObject: 'index.html',
      domainNames: isMainBranch
        ? ['limulus.net', 'www.limulus.net']
        : [`${branchName}.limulus.net`],
      certificate: certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        certificateArn
      ),
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enableLogging: true,
      logBucket: cloudFrontLogsBucket,
      logFilePrefix: 'limulus-dot-net/',
      logIncludesCookies: false,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(staticSiteBucket, {
          originAccessControl,
        }),
        cachePolicy: defaultCachePolicy,
        responseHeadersPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: requestFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
        compress: true,
      },
      additionalBehaviors: {
        '/.well-known/webfinger': {
          origin: new origins.HttpOrigin('mastodon.limulus.net', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
            httpPort: 80,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        '/.well-known/host-meta': {
          origin: new origins.HttpOrigin('mastodon.limulus.net', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
            httpPort: 80,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        '/.well-known/nodeinfo': {
          origin: new origins.HttpOrigin('mastodon.limulus.net', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
            httpPort: 80,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        '/assets/immutable/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticSiteBucket, {
            originAccessControl,
          }),
          cachePolicy: foreverCachePolicy,
          responseHeadersPolicy: immutableResponseHeadersPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        '/*.????????.*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticSiteBucket, {
            originAccessControl,
          }),
          cachePolicy: foreverCachePolicy,
          responseHeadersPolicy: immutableResponseHeadersPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404/index.html',
          ttl: cdk.Duration.seconds(30),
        },
      ],
    })

    // Grant CloudFront access to the S3 bucket via bucket policy
    staticSiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipalReadOnly',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [`${staticSiteBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': distribution.distributionArn,
          },
        },
      })
    )

    // Suppress CDK Nag warnings for CloudFront - WAF and Geo restrictions not needed for static site
    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: 'AwsSolutions-CFR1',
        reason: 'Geo restrictions not required for public static website',
      },
      {
        id: 'AwsSolutions-CFR2',
        reason:
          'WAF not required for static website content without dynamic application logic',
      },
    ])

    // Route53 DNS Records
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: zoneId,
      zoneName: 'limulus.net',
    })

    if (isMainBranch) {
      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: 'limulus.net',
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })

      new route53.AaaaRecord(this, 'AliasRecordAAAA', {
        zone: hostedZone,
        recordName: 'limulus.net',
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })

      new route53.ARecord(this, 'WwwAliasRecord', {
        zone: hostedZone,
        recordName: 'www.limulus.net',
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })

      new route53.AaaaRecord(this, 'WwwAliasRecordAAAA', {
        zone: hostedZone,
        recordName: 'www.limulus.net',
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })
    } else {
      new route53.ARecord(this, 'BranchAliasRecord', {
        zone: hostedZone,
        recordName: `${branchName}.limulus.net`,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })

      new route53.AaaaRecord(this, 'BranchAliasRecordAAAA', {
        zone: hostedZone,
        recordName: `${branchName}.limulus.net`,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      })
    }

    // Outputs
    new cdk.CfnOutput(this, 'StaticSiteBucketName', {
      description: 'Name of the static site S3 bucket',
      value: staticSiteBucket.bucketName,
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionLogsBucketName', {
      description: 'Name of the CloudFront distribution logs S3 bucket',
      value: cloudFrontLogsBucket.bucketName,
    })

    new cdk.CfnOutput(this, 'LogProcessingSqsQueueArn', {
      description: 'ARN of the SQS queue for processing CloudFront logs',
      value: logProcessingQueue.queueArn,
    })
  }
}
