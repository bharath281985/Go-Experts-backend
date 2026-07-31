export class ActivityEngine {
  static async track(
    userId: string,
    module: string,
    action: string,
    targetId?: string,
    metadata?: unknown
  ) {
    try {
      console.log('[Activity]', { userId, module, action, targetId, metadata });
    } catch (error) {
      console.error('ActivityEngine failed to track event:', error);
    }
  }
}
