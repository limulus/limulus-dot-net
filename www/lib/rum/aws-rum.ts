import { AwsRum, AwsRumConfig } from 'aws-rum-web'

const config: AwsRumConfig = {
  sessionSampleRate: 1,
  guestRoleArn:
    'arn:aws:iam::865116139480:role/RUM-Monitor-us-west-2-865116139480-6394798381171-Unauth',
  identityPoolId: 'us-west-2:074a9839-ab68-4f88-9461-fc5b39119ecf',
  endpoint: 'https://dataplane.rum.us-west-2.amazonaws.com',
  telemetries: ['performance', 'errors', 'http'],
  allowCookies: true,
  enableXRay: true,
}

const APPLICATION_ID: string = '19c409c4-3df5-468d-baee-def0dfc827a1'
const APPLICATION_VERSION: string = '1.0.0'
const APPLICATION_REGION: string = 'us-west-2'

export const awsRum: AwsRum = new AwsRum(
  APPLICATION_ID,
  APPLICATION_VERSION,
  APPLICATION_REGION,
  config
)
