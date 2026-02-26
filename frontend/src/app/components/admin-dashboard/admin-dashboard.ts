import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  tournaments: any[] = [];
  filteredTournaments: any[] = [];
  currentTab: string = 'All';
  adminName: string = '';
  loading: boolean = true;
  errorMessage: string = '';

  stats = {
    totalTournaments: 0,
    activeTournaments: 0,
    totalTeams: 0,
    totalPlayers: 0,
    soldPlayers: 0,
    totalSpent: 0
  };

  topTeams: any[] = [];
  topPlayers: any[] = [];
  liveFeed: any[] = [];

  constructor(
    private tournamentService: TournamentService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    const user = this.authService.getUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/login']);
      return;
    }
    this.adminName = user.username;
    this.loadTournaments();
  }

  async loadTournaments() {
    this.loading = true;
    try {
      const data = await this.tournamentService.getAll();

      if (Array.isArray(data)) {
        this.tournaments = data;
        this.filteredTournaments = [...this.tournaments];
        this.calculateStats(data);
      }
    } catch (error: any) {
      console.error('Admin Dashboard: Load failed:', error);
      this.errorMessage = 'Could not load data.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  public setTab(tab: string) {
    console.log('Tab selected:', tab);
    this.currentTab = tab;

    if (tab === 'All') {
      this.filteredTournaments = [...this.tournaments];
    } else if (tab === 'Live') {
      this.filteredTournaments = this.tournaments.filter(t => t.status === 'ACTIVE');
    } else if (tab === 'Upcoming') {
      this.filteredTournaments = this.tournaments.filter(t => t.status === 'UPCOMING');
    } else if (tab === 'Done') {
      this.filteredTournaments = this.tournaments.filter(t => t.status === 'COMPLETED');
    }

    console.log(`Filtered out ${this.filteredTournaments.length} tournaments for ${tab}`);
    this.cdr.detectChanges(); // Force the screen to rethink
  }

  calculateStats(tournaments: any[]) {
    this.stats = {
      totalTournaments: tournaments.length,
      activeTournaments: 0,
      totalTeams: 0,
      totalPlayers: 0,
      soldPlayers: 0,
      totalSpent: 0
    };

    let allTeams: any[] = [];
    let allPlayers: any[] = [];

    // Process Players & Calculate Spent
    tournaments.forEach(t => {
      if (t.status === 'ACTIVE') this.stats.activeTournaments++;

      t.soldPlayersCount = 0;
      t.totalSpent = 0;
      t.totalBudget = 0;

      // Calculate Teams related info
      if (t.teams) {
        this.stats.totalTeams += t.teams.length;
        t.totalBudget = t.teams.reduce((acc: number, curr: any) => acc + curr.budget, 0);
        t.totalSpent = t.teams.reduce((acc: number, curr: any) => acc + (curr.budget - curr.remainingBudget), 0);

        const tournamentTeams = t.teams.map((team: any) => ({
          ...team,
          tournamentName: t.name,
          totalBudget: team.budget,
          playersCount: team.players?.length || 0
        }));
        allTeams.push(...tournamentTeams);
      }

      // Process Players & Compile
      if (t.players) {
        this.stats.totalPlayers += t.players.length;
        t.players.forEach((p: any) => {
          if (p.status === 'SOLD') {
            this.stats.soldPlayers++;
            this.stats.totalSpent += p.soldPrice;
            t.soldPlayersCount++;

            allPlayers.push({
              id: p.id,
              name: p.name,
              role: p.role,
              soldPrice: p.soldPrice,
              ownerTeam: p.soldTo ? t.teams?.find((tm: any) => tm.id === p.soldTo)?.code : 'Unknown'
            });
          }
        });
      }
    });

    // Sort Top Teams (by Remaining Budget desc for now, or total spent?)
    this.topTeams = allTeams.sort((a, b) => b.remainingBudget - a.remainingBudget).slice(0, 5);

    // Sort Highest Sold Players
    this.topPlayers = allPlayers.sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 5);

    this.generateLiveFeed(tournaments);
  }

  generateLiveFeed(tournaments: any[]) {
    const feed: any[] = [];

    tournaments.forEach(t => {
      if (t.players) {
        t.players.forEach((p: any) => {
          if (p.status === 'SOLD' || p.status === 'UNSOLD') {
            let teamName = '';

            if (p.status === 'SOLD') {
              const team = t.teams?.find((tm: any) => tm.id === p.soldTo);
              teamName = team ? team.name : 'Unknown Team';
            }

            feed.push({
              id: `${p.id}-${p.updatedAt}`,
              playerName: p.name,
              status: p.status,
              teamName: teamName,
              amount: p.status === 'SOLD' ? p.soldPrice : p.basePrice,
              iconStr: p.status === 'SOLD' ? '✔' : '✕',
              iconClass: p.status === 'SOLD' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500',
              timeString: this.getTimeAgo(p.updatedAt) || 'recently',
              timestamp: new Date(p.updatedAt).getTime()
            });
          }
        });
      }
    });

    this.liveFeed = feed.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }

  getTimeAgo(dateString: string): string {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  public formatCurrency(value: number): string {
    if (!value) return '0';
    if (value >= 10000000) {
      return (value / 10000000).toFixed(1) + 'Cr';
    } else if (value >= 100000) {
      return (value / 100000).toFixed(0) + 'L';
    } else {
      return value.toLocaleString('en-IN');
    }
  }

  getTournamentIcon(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('premier') || nameLower.includes('league')) return '🔥';
    if (nameLower.includes('super')) return '⚡';
    if (nameLower.includes('cup') || nameLower.includes('gold')) return '🏆';
    if (nameLower.includes('star')) return '⭐';
    if (nameLower.includes('club') || nameLower.includes('open')) return '🏏';
    return '🏆';
  }

  viewTournament(id: number) {
    this.router.navigate(['/tournament-detail', id]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

