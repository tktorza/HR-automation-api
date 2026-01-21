import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayInit,
	OnGatewayConnection,
	OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
	cors: {
		origin: '*',
	},
})
export class NotificationsGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() server: Server;
	private logger: Logger = new Logger('NotificationsGateway');

	afterInit(server: Server) {
		this.logger.log('WebSocket Gateway Initialized');
	}

	handleConnection(client: Socket, ...args: any[]) {
		this.logger.log(`Client connected: ${client.id}`);
		// Ideally, verify JWT token here to join specific tenant room
	}

	handleDisconnect(client: Socket) {
		this.logger.log(`Client disconnected: ${client.id}`);
	}

	// Methods to emit events
	emitWorkflowUpdate(tenantId: string, status: string, message?: string) {
		this.server.emit('workflow_update', { tenantId, status, message });
	}

	emitNewMessages(tenantId: string, count: number) {
		this.server.emit('new_messages', { tenantId, count });
	}
}
