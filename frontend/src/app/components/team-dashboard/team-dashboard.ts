import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-team-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './team-dashboard.html',
    styleUrls: ['./team-dashboard.css']
})
export class TeamDashboardComponent implements OnInit {
    teamName: string = 'Loading...';
    remainingBudget: number = 0;
    totalBudget: number = 100000000;
    squadSize: number = 0;

    tournamentId: number | null = null;
    tournamentName: string = 'Loading...';
    tournamentStatus: string = 'Loading...';

    loading = true;

    constructor(
        private router: Router,
        private http: HttpClient,
        private authService: AuthService
    ) { }

    ngOnInit() {
        // 1. Get logged-in user from auth service
        const user = this.authService.getCurrentUser();

        if (!user) {
            this.router.navigate(['/login']);
            return;
        }

        if (user.role === 'ADMIN') {
            this.router.navigate(['/admin']);
            return;
        }

        this.loading = true;

        // If user is TEAM, fetch their info
        this.teamName = user.team?.name || 'My Team';
        this.remainingBudget = user.team?.remainingBudget || 0;
        this.totalBudget = user.team?.budget || 100000000; // Default if not found
        this.tournamentId = user.team?.tournamentId;

        // 2. Fetch active tournament status for that team
        if (this.tournamentId) {
            this.fetchTournamentInfo(this.tournamentId);
        } else {
            this.tournamentStatus = 'No Tournament Assigned';
            this.loading = false;
        }

    }

    fetchTournamentInfo(id: number) {
        this.http.get(`http://127.0.0.1:5001/api/tournaments/${id}`).subscribe({
            next: (res: any) => {
                this.tournamentName = res.name;
                this.tournamentStatus = res.status;
                this.squadSize = res.teams?.find((t: any) => t.id === this.authService.getCurrentUser()?.teamId)?.players?.length || 0;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching tournament info:', err);
                this.tournamentStatus = 'Error Loading Info';
                this.loading = false;
            }
        });
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
