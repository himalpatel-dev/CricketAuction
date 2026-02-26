import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuctionService {
    private apiUrl = 'http://127.0.0.1:5001/api/auction';

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

    async startPlayerAuction(tournamentId: string | number, playerId: string | number) {
        return firstValueFrom(this.http.post(`${this.apiUrl}/start`, { tournamentId, playerId }, { headers: this.getHeaders() }));
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
}
