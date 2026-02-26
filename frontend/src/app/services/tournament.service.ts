import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TournamentService {
    private apiUrl = 'http://127.0.0.1:5001/api/tournaments';

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

    async getAll() {
        return firstValueFrom(this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() }));
    }

    async create(data: any) {
        return firstValueFrom(this.http.post<any>(this.apiUrl, data, { headers: this.getHeaders() }));
    }

    async getById(id: string | number) {
        return firstValueFrom(this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }));
    }

    async addTeam(tournamentId: string | number, data: any) {
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/teams`, data, { headers: this.getHeaders() }));
    }

    async addPlayer(tournamentId: string | number, data: any) {
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/players`, data, { headers: this.getHeaders() }));
    }

    async registerPlayer(data: any) {
        // Public endpoint for self-registration, no auth headers needed if backend allows
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/register-player`, data));
    }

    async getLatestPublicTournament() {
        return firstValueFrom(this.http.get<any>(`${this.apiUrl}/latest-public`));
    }

    async getOpenTournaments() {
        return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/open-tournaments`));
    }

    async uploadPlayers(tournamentId: string | number, file: File) {
        const formData = new FormData();
        formData.append('file', file);

        // Don't set Content-Type header manually for FormData, browser does it with boundary
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/upload-players`, formData, { headers }));
    }
}
