import { resolveProfileCompletion } from './profile-completion.service.js';

export class ActionRequirementsError extends Error {
  public code = "ACTION_REQUIREMENTS_MISSING";
  public action: string;
  public missing: any[];

  constructor(action: string, missing: any[]) {
    super(`Complete the required details before performing ${action}.`);
    this.name = 'ActionRequirementsError';
    this.action = action;
    this.missing = missing;
  }
}

export const requireCapability = async (params: { userId: string, action: string }) => {
  const { userId, action } = params;
  
  const completion = await resolveProfileCompletion(userId);
  const capability = completion.capabilities[action];
  
  if (!capability) {
    // If capability is entirely undefined, fail safe by throwing.
    throw new ActionRequirementsError(action, []);
  }

  if (!capability.allowed) {
    throw new ActionRequirementsError(action, capability.missing || []);
  }

  return true;
};
