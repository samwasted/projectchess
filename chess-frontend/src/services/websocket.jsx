import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const SOCKET_URL = "http://localhost:8080/ws";

class WebSocketService {
    constructor() {
        this.client = new Client({
            webSocketFactory: () => new SockJS(SOCKET_URL),
            reconnectDelay: 5000, // Auto-reconnect in 5 seconds
            debug: (msg) => console.log(msg),
            onConnect: () => {
                console.log("Connected to WebSocket");

                // Subscribe to game state updates
                this.client.subscribe("/topic/game.state", (message) => {
                    console.log("Game state updated:", JSON.parse(message.body));
                });
            }
        });
    }

    connect() {
        this.client.activate();
    }

    disconnect() {
        this.client.deactivate();
    }

    sendMove(moveData) {
        if (this.client.connected) {
            this.client.publish({ 
                destination: "/app/game.move",
                body: JSON.stringify(moveData) 
            });
        }
    }
}

const webSocketService = new WebSocketService();
export default webSocketService;
