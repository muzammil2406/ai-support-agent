import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /** Support dashboard — live + escalated sessions. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('support_agent', 'admin')
  listForDashboard() {
    return this.sessionsService.listForDashboard();
  }

  /** Current user's own past sessions. */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.listByUser(user.userId);
  }

  /** Full transcript for a session (support only). */
  @Get(':sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('support_agent', 'admin')
  getById(@Param('sessionId') sessionId: string) {
    return this.sessionsService.requireSession(sessionId);
  }
}
