import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * Endpoints para completar OAuth 2.0 con Freelancer.
 * GET  /freelancer-oauth/authorize-url  → URL para abrir en browser
 * GET  /freelancer-oauth/callback?code=  → intercambia code (también podés usar /callback en Next)
 */
@Controller('freelancer-oauth')
export class FreelancerOauthController {
  constructor(private readonly freelancer: FreelancerAuthClient) {}

  @Get('authorize-url')
  @UseGuards(JwtAuthGuard)
  getAuthorizeUrl() {
    return { url: this.freelancer.getAuthorizeUrl() };
  }

  /** Público: Freelancer redirige acá si configuraste redirect al API */
  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).send('Missing code');
    }
    try {
      const tokens = await this.freelancer.exchangeCode(code);
      // En prod guardá en DB/secret manager. Acá devolvemos para copiar a .env
      return res.send(`
        <html><body style="font-family:sans-serif;padding:2rem">
          <h1>OAuth OK</h1>
          <p>Copiá estos valores a tu <code>.env</code> y reiniciá el API:</p>
          <pre style="background:#111;color:#0f0;padding:1rem;overflow:auto">
FREELANCER_ACCESS_TOKEN=${tokens.access_token}
FREELANCER_REFRESH_TOKEN=${tokens.refresh_token || ''}
          </pre>
          <p>Después podés cerrar esta ventana.</p>
        </body></html>
      `);
    } catch (e: any) {
      return res.status(400).send(`Error: ${e.message}`);
    }
  }
}
