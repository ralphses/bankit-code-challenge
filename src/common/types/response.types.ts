export type ErrorDetail = { code: string; message: string };
export type ResponseWrapper<T> = { success: boolean; data: T | null; error: ErrorDetail | null };
export const success = <T>(data: T): ResponseWrapper<T> => ({ success: true, data, error: null });
export const failure = (code: string, message: string): ResponseWrapper<null> => ({ success: false, error: { code, message } } as ResponseWrapper<null>);
