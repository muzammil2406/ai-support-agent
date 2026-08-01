import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Validates the JWT supplied via `socket.handshake.auth.token` (or query).
 * Runs before every @SubscribeMessage handler as defense-in-depth; the
 * connection itself is also checked in ChatGateway.handleConnection.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ?? client.handshake?.query?.token;
    if (!token) return false;
    try {
      const payload = this.jwt.verify(token);
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.role = payload.role;
      return true;
    } catch {
      return false;
    }
  }
}
