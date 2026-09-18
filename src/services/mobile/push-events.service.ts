import { NotificationEngine } from './notification.engine.js';

const queuePush = async (data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  channel?: 'push' | 'all';
}) => {
  if (!data.userId) return;
  await NotificationEngine.queueNotification({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    channel: data.channel || 'push',
    payload: data.payload,
  });
};

export const notifyKycVerified = (userId: string) =>
  queuePush({
    userId,
    type: 'KYC_VERIFIED',
    title: 'KYC verified',
    message: 'Your KYC has been verified. You can now use verified account features.',
    payload: { event: 'kyc_verified', route: '/verification' },
  });

export const notifyKycDocumentVerified = (params: {
  userId: string;
  documentKey: string;
  documentLabel?: string;
}) =>
  queuePush({
    userId: params.userId,
    type: 'KYC_DOCUMENT_VERIFIED',
    title: 'KYC document verified',
    message: `${params.documentLabel || 'Your KYC document'} has been verified by our admin team.`,
    payload: {
      event: 'kyc_document_verified',
      documentKey: params.documentKey,
      documentLabel: params.documentLabel,
      route: '/verification',
    },
  });

export const notifyProfileViewed = (params: {
  profileOwnerId: string;
  viewerId?: string;
  viewerName?: string;
  profileType: string;
  profileId: string;
}) => {
  if (!params.viewerId || params.viewerId === params.profileOwnerId) return Promise.resolve();
  return queuePush({
    userId: params.profileOwnerId,
    type: 'PROFILE_VIEWED',
    title: 'Your profile was viewed',
    message: `${params.viewerName || 'Someone'} viewed your ${params.profileType} profile.`,
    payload: {
      event: 'profile_viewed',
      profileType: params.profileType,
      profileId: params.profileId,
      viewerId: params.viewerId,
    },
  });
};

export const notifyAccountStatusChanged = (userId: string, status: 'active' | 'inactive') =>
  queuePush({
    userId,
    type: status === 'active' ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
    title: status === 'active' ? 'Account activated' : 'Account inactive',
    message: status === 'active'
      ? 'Your account is active again.'
      : 'Your account was marked inactive after an extended period without activity. Log in to reactivate it.',
    payload: { event: status === 'active' ? 'account_activated' : 'account_deactivated', status },
  });

export const notifyProjectApplication = (params: {
  clientId: string;
  freelancerId: string;
  freelancerName?: string;
  projectId: string;
  projectTitle?: string;
}) =>
  queuePush({
    userId: params.clientId,
    type: 'PROJECT_APPLICATION_SUBMITTED',
    title: 'New project application',
    message: `${params.freelancerName || 'A freelancer'} applied to your project${params.projectTitle ? `: ${params.projectTitle}` : '.'}`,
    channel: 'all',
    payload: {
      event: 'project_application_submitted',
      projectId: params.projectId,
      freelancerId: params.freelancerId,
    },
  });
