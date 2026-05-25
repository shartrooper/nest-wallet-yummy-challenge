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
      tap((body) => {
        this.idempotencyService.saveResponse(idempotencyKey, response.statusCode, body).catch(err => {
          if (err.code !== '23505') console.error('Idempotency save error:', err.message);
        });
      }),
      catchError((err) => {
        if (err.status && err.status >= 400 && err.status < 500) {
          this.idempotencyService.saveResponse(idempotencyKey, err.status, err.response).catch(saveErr => {
            if (saveErr.code !== '23505') console.error('Idempotency save error:', saveErr.message);
          });
        }
        throw err;
      }),
    );
  }
}
