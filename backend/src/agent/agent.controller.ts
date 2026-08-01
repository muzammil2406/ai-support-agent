import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';

/**
 * Standalone REST endpoint used to test the LangGraph agent before (and
 * independently of) the WebSocket path. curl-able:
 *   curl -X POST http://localhost:3001/api/agent/chat \
 *        -H "Content-Type: application/json" \
 *        -d '{"message":"Where is my order ORD-1042?"}'
 */
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: AgentChatDto) {
    return this.agentService.streamResponse(dto.message, {
      sessionId: dto.sessionId,
    });
  }
}
