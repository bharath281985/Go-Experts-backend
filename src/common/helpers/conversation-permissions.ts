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

  const rolePair = [userRole, targetRole].sort().join("-");

  if (rolePair === "client-freelancer" || rolePair === "founder-freelancer") {
    return ["PROJECT", "PROPOSAL", "INVITATION"].includes(contextType || "") && !!contextId;
  }

  if (rolePair === "founder-investor") {
    return ["INVESTMENT", "STARTUP", "MEETING"].includes(contextType || "") && !!contextId;
  }

  // Same role direct messaging or unspecified pairs are blocked without explicit GENERAL rules
  // (Assuming false by default for strictness)
  return false;
}
