export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  } | null;
  errors?: any[];
  code?: string | number;
  timestamp: string;
}

export const successResponse = <T>(
  message: string,
  data?: T,
  meta?: any
): ApiResponse<T> => ({
  success: true,
  message,
  data: (data ?? null) as T,
  meta: meta ?? null,
  timestamp: new Date().toISOString()
});

export const errorResponse = (
  message: string,
  code: string | number = 'ERROR',
  errors: any[] = []
): ApiResponse => ({
  success: false,
  message,
  data: null,
  meta: null,
  errors,
  code: typeof code === 'number' ? String(code) : code,
  timestamp: new Date().toISOString()
});
