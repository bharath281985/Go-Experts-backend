export type ConversationContextType = 
  | "PROJECT"
  | "PROPOSAL"
  | "INVITATION"
  | "INVESTMENT"
  | "STARTUP"
  | "MEETING"
  | "SUPPORT"
  | "DISPUTE"
  | "ADMIN"
  | "GENERAL";

export function canCreateConversation(
  userRole: string,
  targetRole: string,
  contextType?: string,
  contextId?: string
): boolean {
  if (userRole === "admin" || targetRole === "admin") {
    return contextType === "SUPPORT" || contextType === "DISPUTE" || contextType === "ADMIN";
  }

  // Any authenticated platform user can start a conversation about a startup or general inquiry
  if (contextType === "STARTUP" || contextType === "GENERAL" || !contextType) {
    return true;
  }

  const rolePair = [userRole, targetRole].sort().join("-");

  if (rolePair === "client-freelancer" || rolePair === "founder-freelancer") {
    return ["PROJECT", "PROPOSAL", "INVITATION", "STARTUP", "GENERAL"].includes(contextType || "");
  }

  if (rolePair === "founder-investor") {
    return ["INVESTMENT", "STARTUP", "MEETING", "GENERAL"].includes(contextType || "");
  }

  return true;
}
