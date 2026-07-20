// src/common/http/http-client.service.ts
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const start = Date.now();
    const requestId = `req_${Date.now()}`;

    this.logger.debug(`[${requestId}] ${config.method} ${config.url}`);

    if (!this.circuitBreaker.canExecute(config.url!)) {
      throw new HttpException('Service temporarily unavailable (circuit open)', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          timeout: 15000,
          ...config,
          headers: {
            'User-Agent': 'FSTailPlatform/1.0',
            ...config.headers,
          },
        }),
      );

      this.logger.debug(`[${requestId}] ${response.status} in ${Date.now() - start}ms`);
      this.circuitBreaker.recordSuccess(config.url!);

      return response.data;
    } catch (error: any) {
      this.circuitBreaker.recordFailure(config.url!);
      this.logger.error(`[${requestId}] Failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}

// Simple Circuit Breaker (puedes expandir)
class CircuitBreaker {
  private failures = new Map<string, { count: number; lastFailure: Date }>();
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 min

  canExecute(url: string): boolean {
    const entry = this.failures.get(url);
    if (!entry) return true;
    if (Date.now() - entry.lastFailure.getTime() > this.timeout) {
      entry.count = 0;
      return true;
    }
    return entry.count < this.threshold;
  }

  recordFailure(url: string) {
    const entry = this.failures.get(url) || { count: 0, lastFailure: new Date() };
    entry.count++;
    entry.lastFailure = new Date();
    this.failures.set(url, entry);
  }

  recordSuccess(url: string) {
    this.failures.delete(url);
  }
}