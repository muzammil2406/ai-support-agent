import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AgentChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
