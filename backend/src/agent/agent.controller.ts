import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

/**
 * Standalone REST endpoint used to test the LangGraph agent before (and
 * independently of) the WebSocket path. Requires a valid JWT (Bearer token):
 *   curl -X POST http://localhost:3001/api/agent/chat \
 *        -H "Authorization: Bearer <token>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"message":"Where is my order?"}'
 */
@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: AgentChatDto) {
    return this.agentService.streamResponse(dto.message, {
      sessionId: dto.sessionId,
      userId: user.userId,
    });
  }
}
