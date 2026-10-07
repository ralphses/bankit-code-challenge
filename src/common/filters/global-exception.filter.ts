import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../errors/domain-error';
import { failure } from '../types/response.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof DomainError) {
      response.status(exception.status).json(failure(exception.code, exception.message));
      return;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const raw = typeof body === 'object' && body !== null && 'message' in body ? (body as { message?: unknown }).message : undefined;
      const message = Array.isArray(raw) ? String(raw[0]) : String(raw ?? 'Request validation failed');
      response.status(exception.getStatus()).json(failure('INVALID_REQUEST', message));
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(failure('TRANSFER_FAILED', 'The transfer could not be completed'));
  }
}
