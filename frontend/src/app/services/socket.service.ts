import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SocketService {
    private socket: Socket | null = null;
    private readonly baseUrl = 'http://127.0.0.1:5001';

    get isConnected(): boolean {
        return this.socket?.connected || false;
    }

    constructor() { }

    connectToTournament(tournamentId: string | number) {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = io(this.baseUrl);

        this.socket.on('connect', () => {
            console.log('Connected to socket server');
            this.socket?.emit('join_tournament', tournamentId);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from socket server');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(eventName: string, callback: (data: any) => void) {
        this.socket?.on(eventName, callback);
    }

    off(eventName: string) {
        this.socket?.off(eventName);
    }

    emit(eventName: string, data: any) {
        if (!this.socket) {
            console.warn(`Attempted to emit ${eventName} before socket connection.`);
            return;
        }
        this.socket.emit(eventName, data);
    }

    // Observable version if needed
    onObservable(eventName: string): Observable<any> {
        return new Observable(observer => {
            if (!this.socket) {
                return;
            }
            this.socket.on(eventName, (data) => observer.next(data));
            return () => this.socket?.off(eventName);
        });
    }
}
