import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  EntityNotFoundError,
  UnknownServiceError,
  CommandExecutionError,
  AuthenticationError,
} from '../exceptions/errors';

// Catch-all filter producing the house-style envelope:
// { success:false, error, message, statusCode, timestamp, path }
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      error = exception.name;
      message =
        typeof res === 'string'
          ? res
          : ((res as any).message ?? exception.message);
    } else if (
      exception instanceof EntityNotFoundError ||
      exception instanceof UnknownServiceError
    ) {
      status = HttpStatus.NOT_FOUND;
      error = exception.name;
      message = exception.message;
    } else if (exception instanceof AuthenticationError) {
      status = HttpStatus.UNAUTHORIZED;
      error = exception.name;
      message = exception.message;
    } else if (exception instanceof CommandExecutionError) {
      status = HttpStatus.BAD_GATEWAY;
      error = exception.name;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${String(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      error,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
