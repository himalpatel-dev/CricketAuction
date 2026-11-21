import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
@Injectable({
    providedIn: 'root'
})
export class AuctionService {
    private apiUrl = `${API_CONFIG.baseUrl}/api/auction`;

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    private getHeaders() {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        });
    }

    async getAuctionState(tournamentId: string | number) {
        return firstValueFrom(this.http.get(`${this.apiUrl}/state/${tournamentId}`, { headers: this.getHeaders() }));
    }

    async startPlayerAuction(tournamentId: string | number, playerId: string | number | null, status?: string) {
        return firstValueFrom(this.http.post(`${this.apiUrl}/start`, { tournamentId, playerId, status }, { headers: this.getHeaders() }));
    }

    async placeBid(tournamentId: string | number, playerId: string | number, amount: number, teamId: string | number) {
        return firstValueFrom(this.http.post(`${this.apiUrl}/bid`, { tournamentId, playerId, amount, teamId }, { headers: this.getHeaders() }));
    }

    async sellPlayer(tournamentId: string | number, playerId: string | number) {
        return firstValueFrom(this.http.post(`${this.apiUrl}/sell`, { tournamentId, playerId }, { headers: this.getHeaders() }));
    }

    async markUnsold(tournamentId: string | number, playerId: string | number) {
        return firstValueFrom(this.http.post(`${this.apiUrl}/unsold`, { tournamentId, playerId }, { headers: this.getHeaders() }));
    }

    /**
     * Tell the server the admin left the auction board so the timer pauses immediately.
     * Uses sendBeacon (form-encoded, no CORS preflight) because it still gets delivered while
     * the page is closing / navigating away, where a normal HTTP or socket call may be dropped.
     */
    notifyAdminLeft(tournamentId: string | number, socketId: string | null) {
        const url = `${this.apiUrl}/admin-left`;
        const body = new URLSearchParams({ tournamentId: String(tournamentId), socketId: socketId || '' });
        try {
            if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
        } catch { /* fall through */ }
        fetch(url, { method: 'POST', body, keepalive: true }).catch(() => { });
    }
}
