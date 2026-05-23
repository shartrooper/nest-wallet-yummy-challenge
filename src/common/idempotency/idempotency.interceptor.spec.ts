import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let service: IdempotencyService;

  beforeEach(() => {
    service = {
      getResponse: jest.fn(),
      saveResponse: jest.fn(),
    } as any;
    interceptor = new IdempotencyInterceptor(service);
  });

  const mockContext = (headers: any = {}, statusCode = 200) => ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({
        status: jest.fn(),
        statusCode,
      }),
    }),
  } as unknown as ExecutionContext);

  const mockNext = (data: any) => ({
    handle: () => of(data),
  } as CallHandler);

  it('should pass through if no idempotency key', async () => {
    const context = mockContext();
    const next = mockNext({ success: true });

    const result = await (await interceptor.intercept(context, next)).toPromise();

    expect(result).toEqual({ success: true });
    expect(service.getResponse).not.toHaveBeenCalled();
  });

  it('should return cached response if key exists', async () => {
    const context = mockContext({ 'x-idempotency-key': 'key-1' });
    const next = { handle: jest.fn() } as any;
    (service.getResponse as jest.Mock).mockResolvedValue({
      status_code: 201,
      response_body: { cached: true },
    });

    const result = await (await interceptor.intercept(context, next)).toPromise();

    expect(result).toEqual({ cached: true });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('should process and save response if key does not exist', async () => {
    const context = mockContext({ 'x-idempotency-key': 'key-2' });
    const next = mockNext({ new: true });
    (service.getResponse as jest.Mock).mockResolvedValue(null);

    const result = await (await interceptor.intercept(context, next)).toPromise();

    expect(result).toEqual({ new: true });
    expect(service.saveResponse).toHaveBeenCalledWith('key-2', 200, { new: true });
  });
});
