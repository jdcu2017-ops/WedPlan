import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { MessagesRepository } from "./messages.repository";

// Realtime push only — REST (MessagesController) is the single write path.
// Clients connect, authenticate via handshake, then join a room per
// conversation (participant-verified) to receive live `message` events.
// Decorator options are evaluated before Nest's DI container exists, so this
// reads process.env directly — same reasoning as the CORS setup in main.ts.
@WebSocketGateway({
  namespace: "/messaging",
  cors: { origin: process.env.WEB_URL ?? "http://localhost:3000", credentials: true },
})
export class MessagingGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>("jwt.accessSecret"),
      });
      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join_conversation")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId?: string },
  ): Promise<void> {
    const user = client.data.user as AccessTokenPayload | undefined;
    if (!user || !data?.conversationId) {
      return;
    }
    const participants = await this.messagesRepository.findParticipants(data.conversationId);
    if (!participants) {
      client.emit("error", { message: "Conversation not found" });
      return;
    }
    if (participants.inquirer_id !== user.sub && participants.vendor_id !== user.sub) {
      client.emit("error", { message: "Not a participant in this conversation" });
      return;
    }
    await client.join(this.roomName(data.conversationId));
  }

  broadcastMessage(conversationId: string, message: unknown): void {
    if (!this.server) {
      this.logger.warn("WebSocket server not initialized yet — dropping broadcast");
      return;
    }
    this.server.to(this.roomName(conversationId)).emit("message", message);
  }

  private roomName(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token;
    return typeof queryToken === "string" ? queryToken : undefined;
  }
}
