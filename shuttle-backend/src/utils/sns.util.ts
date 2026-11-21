import {
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  PublishCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from '@aws-sdk/client-sns';

export const SNS_PLATFORM_APPLICATION_ARN =
  process.env.AWS_SNS_PLATFORM_APPLICATION_ARN ||
  'arn:aws:sns:ap-southeast-2:485185308729:app/GCM/TakeMe-Push-FCM';

/** 앱(PushNotificationService)이 만드는 안드로이드 알림 채널 ID 와 같아야 한다 */
export const ANDROID_PUSH_CHANNEL_ID = 'takeme_push_channel';

let cachedSnsClient: SNSClient | null = null;

export function getSnsClient(): SNSClient {
  if (!cachedSnsClient) {
    cachedSnsClient = new SNSClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    });
  }
  return cachedSnsClient;
}

/**
 * 디바이스 토큰(FCM Token)을 AWS SNS 플랫폼 애플리케이션의 엔드포인트로 등록/갱신
 */
export async function registerDeviceEndpoint(
  deviceToken: string,
  customUserData?: string,
): Promise<string> {
  const client = getSnsClient();
  try {
    const res = await client.send(
      new CreatePlatformEndpointCommand({
        PlatformApplicationArn: SNS_PLATFORM_APPLICATION_ARN,
        Token: deviceToken,
        CustomUserData: customUserData,
      }),
    );
    return res.EndpointArn!;
  } catch (err: any) {
    // 이미 등록된 토큰인 경우 에러 메시지에서 기존 EndpointArn 추출 후 재활성화
    const match = err?.message?.match(/Endpoint (arn:aws:sns:[^ ]+) already exists/);
    if (match && match[1]) {
      const endpointArn = match[1];
      try {
        await client.send(
          new SetEndpointAttributesCommand({
            EndpointArn: endpointArn,
            Attributes: {
              Token: deviceToken,
              Enabled: 'true',
            },
          }),
        );
      } catch (attrErr) {
        console.warn(`[SNS] Failed to update endpoint attributes for ${endpointArn}:`, attrErr);
      }
      return endpointArn;
    }
    console.error('[SNS] Failed to create platform endpoint:', err);
    throw err;
  }
}

/**
 * AWS SNS 모바일 푸시 알림 전송 (FCM/GCM 규격 페이로드)
 */
export async function sendSnsPushNotification(
  endpointArn: string,
  title: string,
  body: string,
  dataPayload?: Record<string, any>,
): Promise<boolean> {
  if (!endpointArn) return false;

  const client = getSnsClient();
  const stringifiedData: Record<string, string> = {
    title,
    body,
    timestamp: new Date().toISOString(),
  };

  if (dataPayload) {
    for (const [key, value] of Object.entries(dataPayload)) {
      stringifiedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  // SNS 플랫폼 앱이 FCM HTTP v1 방식이므로 fcmV1Message 형식으로 보낸다.
  // (예전 GCM 형식 {notification, data} 를 보내면 휴대폰에 제목·내용이 빈 알림이 뜬다)
  // notification 이 있어야 앱이 꺼져 있거나 백그라운드일 때도 안드로이드가 알림창에 바로 띄운다.
  const fcmV1Payload = {
    fcmV1Message: {
      message: {
        notification: { title, body },
        data: stringifiedData,
        android: {
          priority: 'high',
          notification: {
            channel_id: ANDROID_PUSH_CHANNEL_ID,
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: { aps: { alert: { title, body }, sound: 'default' } },
        },
      },
    },
  };

  const message = JSON.stringify({
    default: body,
    GCM: JSON.stringify(fcmV1Payload),
  });

  try {
    await client.send(
      new PublishCommand({
        TargetArn: endpointArn,
        Message: message,
        MessageStructure: 'json',
      }),
    );
    return true;
  } catch (err: any) {
    console.error(`[SNS] Failed to publish push to ${endpointArn}:`, err?.message || err);
    // 엔드포인트가 비활성화/삭제된 경우 비활성화 처리 가능
    return false;
  }
}

/**
 * 엔드포인트 삭제 (로그아웃 등)
 */
export async function deleteDeviceEndpoint(endpointArn: string): Promise<void> {
  if (!endpointArn) return;
  try {
    const client = getSnsClient();
    await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));
  } catch (err: any) {
    console.warn(`[SNS] Failed to delete endpoint ${endpointArn}:`, err?.message || err);
  }
}
