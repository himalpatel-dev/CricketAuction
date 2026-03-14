import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TopNavComponent } from '../top-nav/top-nav';
import { FormsModule } from '@angular/forms';
import { PlayerCardComponent } from '../player-card/player-card.component';

@Component({
    selector: 'app-team-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, TopNavComponent, PlayerCardComponent],
    templateUrl: './team-dashboard.html',
    styleUrls: ['./team-dashboard.css']
})
export class TeamDashboardComponent implements OnInit {
    teamName: string = 'Loading...';
    remainingBudget: number = 0;
    totalBudget: number = 100000000;
    squadSize: number = 0;

    tournamentId: number | null = null;
    teamId: number | null = null;
    tournamentName: string = 'Loading...';
    tournamentStatus: string = 'Loading...';

    loading = true;
    isAdminView = false;

    stats = {
        highestBid: 0,
        highestBidder: 'N/A',
        usedPercentage: 0,
        rank: 1,
        rankSubtext: 'Stable position',
        totalSlots: 25,
        battingCount: 0,
        bowlingCount: 0,
        arCount: 0,
        wkCount: 0,
        captainName: 'Unassigned'
    };

    tournament: any = null;
    playerSearchTerm: string = '';
    selectedRole: string = 'All';
    currentTab: any = 'Overview';
    bidActivity: any[] = [];

    teamUpdate = {
        name: '',
        code: '',
        ownerName: '',
        budget: 0,
        captainId: null as number | null
    };

    selectedLogoFile: File | null = null;
    logoPreview: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private http: HttpClient,
        private authService: AuthService
    ) { }

    setTab(tab: string) {
        this.currentTab = tab;
        if (tab === 'Settings') {
            this.teamUpdate = {
                name: this.teamName,
                code: '', // We'll need to fetch this or store it
                ownerName: '', // Fetch or store
                budget: this.totalBudget,
                captainId: null
            };
            // Re-fetch full team info to populate settings if needed
            this.fetchFullTeamInfo();
        }
    }

    fetchFullTeamInfo() {
        if (!this.teamId) return;
        this.http.get(`http://127.0.0.1:5001/api/tournaments/${this.tournamentId}`).subscribe({
            next: (res: any) => {
                const team = res.teams?.find((t: any) => t.id === this.teamId);
                if (team) {
                    this.teamUpdate = {
                        name: team.name,
                        code: team.code,
                        ownerName: team.ownerName || '',
                        budget: team.budget,
                        captainId: team.captainId
                    };
                    this.logoPreview = team.logoUrl;
                }
            }
        });
    }

    handleLogoChange(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedLogoFile = file;
            const reader = new FileReader();
            reader.onload = (e: any) => this.logoPreview = e.target.result;
            reader.readAsDataURL(file);
        }
    }

    updateTeamDetails() {
        if (!this.teamId) return;

        const formData = new FormData();
        formData.append('name', this.teamUpdate.name);
        formData.append('code', this.teamUpdate.code);
        formData.append('ownerName', this.teamUpdate.ownerName);
        formData.append('budget', this.teamUpdate.budget.toString());
        if (this.teamUpdate.captainId) {
            formData.append('captainId', this.teamUpdate.captainId.toString());
        }
        if (this.selectedLogoFile) {
            formData.append('logo', this.selectedLogoFile);
        }

        this.http.put(`http://127.0.0.1:5001/api/teams/${this.teamId}`, formData).subscribe({
            next: (res: any) => {
                alert('Team details updated successfully!');
                this.teamName = res.name;
                this.totalBudget = res.budget;
                this.fetchTournamentInfo(this.tournamentId!);
                this.selectedLogoFile = null;
            },
            error: (err) => alert('Error updating team: ' + err.message)
        });
    }

    fetchBidActivity() {
        if (!this.teamId) return;
        this.http.get(`http://127.0.0.1:5001/api/auction/team-activity/${this.teamId}`).subscribe({
            next: (res: any) => {
                this.bidActivity = res;
            },
            error: (err) => console.error('Error fetching bid activity:', err)
        });
    }

    ngOnInit() {
        // 1. Check for route parameters (Admin/Viewer mode)
        const tIdParam = this.route.snapshot.paramMap.get('tournamentId');
        const teamIdParam = this.route.snapshot.paramMap.get('teamId');

        if (tIdParam && teamIdParam) {
            this.isAdminView = true;
            this.tournamentId = +tIdParam;
            this.teamId = +teamIdParam;
            this.fetchTournamentInfo(this.tournamentId);
            this.fetchBidActivity();
            return;
        }

        // 2. Default: Get logged-in user from auth service (Team mode)
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
        this.teamId = user.teamId;

        if (this.tournamentId) {
            this.fetchTournamentInfo(this.tournamentId);
        }

        if (this.teamId) {
            this.fetchBidActivity();
        } else {
            this.tournamentStatus = 'No Tournament Assigned';
            this.loading = false;
        }
    }

    squadPlayers: any[] = [];

    get filteredPlayers() {
        if (!this.squadPlayers) return [];
        let filtered = this.squadPlayers;

        // Filter by Role
        if (this.selectedRole !== 'All') {
            filtered = filtered.filter(p => p.role === this.selectedRole);
        }

        // Filter by Search Term
        const term = (this.playerSearchTerm || '').trim().toLowerCase();
        if (term) {
            filtered = filtered.filter((player: any) =>
                player.name?.toLowerCase().includes(term) ||
                player.role?.toLowerCase().includes(term) ||
                player.city?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }

    fetchTournamentInfo(id: number) {
        this.http.get(`http://127.0.0.1:5001/api/tournaments/${id}`).subscribe({
            next: (res: any) => {
                this.tournament = res;
                this.tournamentName = res.name;
                this.tournamentStatus = res.status;

                const teams = res.teams || [];
                const team = teams.find((t: any) => t.id === this.teamId);

                if (team) {
                    this.teamName = team.name;
                    this.remainingBudget = team.remainingBudget;
                    this.totalBudget = team.budget || 10000000;
                    this.squadSize = team.players?.length || 0;
                    this.squadPlayers = team.players || [];

                    // Calculate stats for this team
                    let hBid = 0;
                    let hBidder = 'N/A';
                    let bat = 0, bwl = 0, ar = 0, wk = 0;

                    this.squadPlayers.forEach((p: any) => {
                        const price = p.soldPrice || 0;
                        if (price > hBid) {
                            hBid = price;
                            hBidder = p.name;
                        }

                        if (p.role === 'Batsman') bat++;
                        else if (p.role === 'Bowler') bwl++;
                        else if (p.role === 'All-Rounder') ar++;
                        else if (p.role === 'Wicketkeeper') wk++;
                    });

                    // Calculate Rank based on Remaining Budget
                    const sortedTeams = [...teams].sort((a: any, b: any) => b.remainingBudget - a.remainingBudget);
                    const rank = sortedTeams.findIndex((t: any) => t.id === this.teamId) + 1;

                    let rSub = 'Healthy balance';
                    if (rank === 1) rSub = 'Most budget left';
                    else if (rank === teams.length) rSub = 'Tightest budget';
                    else if (rank <= 3) rSub = 'Top tier liquidity';

                    const usedP = ((this.totalBudget - this.remainingBudget) / (this.totalBudget || 1)) * 100;
                    const captain = this.squadPlayers.find((p: any) => p.id === team.captainId);

                    this.stats = {
                        highestBid: hBid,
                        highestBidder: hBidder,
                        usedPercentage: usedP,
                        rank: rank,
                        rankSubtext: rSub,
                        totalSlots: 25, // Image specifically shows 25 slots
                        battingCount: bat,
                        bowlingCount: bwl,
                        arCount: ar,
                        wkCount: wk,
                        captainName: captain ? captain.name : 'Unassigned'
                    };
                }

                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching tournament info:', err);
                this.tournamentStatus = 'Error Loading Info';
                this.loading = false;
            }
        });
    }

    formatCurrency(value: number): string {
        if (!value) return '0';
        if (value >= 10000000) {
            const cr = value / 10000000;
            return cr % 1 === 0 ? cr.toFixed(0) + 'Cr' : cr.toFixed(2) + 'Cr';
        } else if (value >= 100000) {
            return (value / 100000).toFixed(0) + 'L';
        } else {
            return value.toLocaleString('en-IN');
        }
    }

    formatInCr(value: number): { val: string, unit: string } {
        if (!value) return { val: '0', unit: 'Cr' };
        const cr = value / 10000000;
        return {
            val: cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1),
            unit: 'Cr'
        };
    }

    formatInL(value: number): { val: string, unit: string } {
        if (!value) return { val: '0', unit: 'L' };
        const l = value / 100000;
        return {
            val: l % 1 === 0 ? l.toFixed(0) : l.toFixed(1),
            unit: 'L'
        };
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
