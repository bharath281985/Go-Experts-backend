const rateLimits = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (userId: string, action: string, limit: number, windowMs: number): boolean => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  let record = rateLimits.get(key);
  
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimits.set(key, record);
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count += 1;
  return true;
};
