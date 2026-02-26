import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://127.0.0.1:5001/api/auth';

    constructor(private http: HttpClient) { }

    async login(credentials: any) {
        try {
            const data: any = await firstValueFrom(this.http.post(`${this.apiUrl}/login`, credentials));
            if (data && data.token) {
                this.saveSession(data.token, data.user);
            }
            return data;
        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    }

    async register(userData: any) {
        try {
            return await firstValueFrom(this.http.post(`${this.apiUrl}/register`, userData));
        } catch (error) {
            console.error("Registration Error:", error);
            throw error;
        }
    }

    saveSession(token: string, user: any) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    getToken() {
        return localStorage.getItem('token');
    }

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    isAdmin() {
        const user = this.getUser();
        return user?.role === 'ADMIN';
    }

    isTeam() {
        const user = this.getUser();
        return user?.role === 'TEAM';
    }

    isTournamentAdmin() {
        const user = this.getUser();
        return user?.role === 'TOURNAMENT_ADMIN';
    }

    getCurrentUser() {
        return this.getUser();
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}
