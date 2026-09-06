import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PostConversationService } from './post-conversation.service';

/**
 * Queue monitoring endpoint. Protected like the rest of the support dashboard.
 *
 * GET /api/queue/status
 */
@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('support_agent', 'admin')
export class QueueMonitorController {
  constructor(private readonly postConversation: PostConversationService) {}

  @Get('status')
  status() {
    return this.postConversation.status();
  }
}
