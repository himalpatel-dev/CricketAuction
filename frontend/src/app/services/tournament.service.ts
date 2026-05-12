import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class TournamentService {
    private apiUrl = `${API_CONFIG.baseUrl}/api/tournaments`;

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

    async update(id: string | number, data: any) {
        return firstValueFrom(this.http.put<any>(`${this.apiUrl}/${id}`, data, { headers: this.getHeaders() }));
    }

    async addTeam(tournamentId: string | number, data: any) {
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/teams`, data, { headers: this.getHeaders() }));
    }

    async addPlayer(tournamentId: string | number, data: any) {
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/players`, data, { headers: this.getHeaders() }));
    }

    async updatePlayer(tournamentId: string | number, playerId: string | number, data: any) {
        return firstValueFrom(this.http.put<any>(`${this.apiUrl}/${tournamentId}/players/${playerId}`, data, { headers: this.getHeaders() }));
    }

    async removePlayer(tournamentId: string | number, playerId: string | number) {
        return firstValueFrom(this.http.delete<any>(`${this.apiUrl}/${tournamentId}/players/${playerId}`, { headers: this.getHeaders() }));
    }

    async registerPlayer(data: any) {
        // Public endpoint for self-registration, no auth headers needed if backend allows
        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/register-player`, data));
    }

    async checkPlayerByMobile(mobileNo: string) {
        return firstValueFrom(this.http.get<any>(`${this.apiUrl}/check-player/${mobileNo}`));
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

        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return firstValueFrom(this.http.post<any>(`${this.apiUrl}/${tournamentId}/upload-players`, formData, { headers }));
    }

    async getDashboardRosters() {
        return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/dashboard/rosters`, { headers: this.getHeaders() }));
    }

    async getTeamPlayers(teamId: string | number) {
        return firstValueFrom(this.http.get<any[]>(`${API_CONFIG.baseUrl}/api/teams/${teamId}/players`, { headers: this.getHeaders() }));
    }

    async getGlobalPlayers(filters: any = {}) {
        let queryParams = '?';
        if (filters.search) queryParams += `search=${filters.search}&`;
        if (filters.role) queryParams += `role=${filters.role}&`;
        if (filters.city) queryParams += `city=${filters.city}&`;
        if (filters.excludeTournamentId) queryParams += `excludeTournamentId=${filters.excludeTournamentId}&`;

        return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/global/players${queryParams}`, { headers: this.getHeaders() }));
    }
}
