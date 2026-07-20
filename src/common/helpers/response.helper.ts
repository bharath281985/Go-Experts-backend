import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface StandardResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  pagination?: PaginationMeta;
  errors?: any;
  requestId: string;
  timestamp: string;
}

export function sendResponse<T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: T,
  options: {
    meta?: any;
    pagination?: PaginationMeta;
    errors?: any;
  } = {}
) {
  const requestId = (res.req as any).requestId || `req_${Math.random().toString(36).substring(2, 11)}`;
  const response: StandardResponse<T> = {
    success,
    message,
    data,
    meta: options.meta,
    pagination: options.pagination,
    errors: options.errors,
    requestId,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}
