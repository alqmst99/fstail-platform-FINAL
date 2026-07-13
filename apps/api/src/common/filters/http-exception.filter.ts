// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches all HttpExceptions and normalises them to a consistent shape.
 *
 * Response shape:
 * {
 *   statusCode: 400,
 *   message: "Validation failed" | ["field must be X", ...],
 *   error: "Bad Request",
 *   path: "/api/auth/login",
 *   timestamp: "2024-01-01T00:00:00.000Z"
 * }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>)['message'] ??
          exception.message;

    const error =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)['error']
        : HttpStatus[status];

    // Log 5xx errors as errors, 4xx as warnings
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception.stack,
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
