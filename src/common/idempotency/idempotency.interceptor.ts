import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';
import { Response } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const cachedResponse = await this.idempotencyService.getResponse(idempotencyKey);
    if (cachedResponse) {
      response.status(cachedResponse.status_code);
      return of(cachedResponse.response_body);
    }

    return next.handle().pipe(
      tap(async (body) => {
        try {
          await this.idempotencyService.saveResponse(idempotencyKey, response.statusCode, body);
        } catch (err) {
          // If another request already saved the response, we ignore the error
          if (err.code !== '23505') throw err;
        }
      }),
      catchError(async (err) => {
        // We also want to cache error responses if they are deterministic (e.g. 400, 422)
        if (err.status && err.status >= 400 && err.status < 500) {
          try {
            await this.idempotencyService.saveResponse(idempotencyKey, err.status, err.response);
          } catch (saveErr) {
            // Ignore unique violations in race conditions
            if (saveErr.code !== '23505') throw saveErr;
          }
        }
        throw err;
      }),
    );
  }
}
