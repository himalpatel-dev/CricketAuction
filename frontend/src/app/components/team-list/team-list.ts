import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

import { TeamCardComponent } from '../team-card/team-card.component';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TeamCardComponent],
  templateUrl: './team-list.html',
  styleUrls: ['./team-list.css']
})
export class TeamListComponent implements OnInit {
  tournamentId: string | null = null;
  tournament: any = null;
  allTournaments: any[] = [];
  rawTeams: any[] = [];
  filteredTeams: any[] = [];

  loading = true;
  showModal = false;
  isAllTeamsMode = false;

  newTeam = { name: '', code: '', budget: 100000000 };
  backLink = '';

  // Stats
  stats = {
    totalTeams: 0,
    activeTeams: 0,
    tournamentsCount: 0,
    lowBudgetCount: 0,
    totalBudgets: 0
  };

  // Filters
  searchQuery = '';
  activeFilter = 'All'; // All, Active, Squad Full, Low Budget
  sortOption = 'Name';

  constructor(
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.tournamentId = this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();

    if (this.tournamentId) {
      if (this.authService.isTournamentAdmin()) {
        this.backLink = `/tournament-detail/${user.tournamentId}`;
      } else {
        this.backLink = `/tournament-detail/${this.tournamentId}`;
      }
      this.isAllTeamsMode = false;
      this.loadSingleTournamentTeams();
    } else {
      this.backLink = '/admin'; // or dashboard
      this.isAllTeamsMode = true;
      this.loadAllTeams();
    }
  }

  async loadSingleTournamentTeams() {
    if (!this.tournamentId) return;
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(this.tournamentId);
      this.allTournaments = [this.tournament];
      this.processTeams(this.allTournaments);
    } catch (err: any) {
      console.error('Error loading tournament teams:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadAllTeams() {
    this.loading = true;
    try {
      const data = await this.tournamentService.getAll();
      if (Array.isArray(data)) {
        this.allTournaments = data;
        this.processTeams(this.allTournaments);
      }
    } catch (err) {
      console.error('Error loading all teams:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  processTeams(tournaments: any[]) {
    this.rawTeams = [];
    tournaments.forEach(t => {
      if (t.teams) {
        t.teams.forEach((team: any) => {
          this.rawTeams.push({
            ...team,
            tournamentName: t.name,
            tournamentStatus: t.status,
            tournamentId: t.id,
            ownerName: team.ownerName || 'Admin',
            // calculate players etc
            playersCount: team.players?.length || 0,
            batsmenCount: team.players?.filter((p: any) => p.role === 'BATSMAN').length || 0,
            bowlersCount: team.players?.filter((p: any) => p.role === 'BOWLER').length || 0,
            arWkCount: team.players?.filter((p: any) => p.role === 'ALL_ROUNDER' || p.role === 'WICKET_KEEPER').length || 0,

            isActive: t.status === 'ACTIVE',
            isLowBudget: team.remainingBudget < (team.budget * 0.2),
            isSquadFull: (team.players?.length || 0) >= 15 // Assuming 15 is full, adjust if needed
          });
        });
      }
    });

    this.calculateStats();
    this.applyFilters();
  }

  calculateStats() {
    this.stats = {
      totalTeams: this.rawTeams.length,
      activeTeams: this.rawTeams.filter(t => t.isActive).length,
      tournamentsCount: this.allTournaments.length,
      lowBudgetCount: this.rawTeams.filter(t => t.isLowBudget).length,
      totalBudgets: this.rawTeams.reduce((sum, t) => sum + (t.budget || 0), 0)
    };
  }

  applyFilters() {
    let result = [...this.rawTeams];

    // search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.ownerName?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q)
      );
    }

    // status filter
    if (this.activeFilter === 'Active') {
      result = result.filter(t => t.isActive);
    } else if (this.activeFilter === 'Squad Full') {
      result = result.filter(t => t.isSquadFull);
    } else if (this.activeFilter === 'Low Budget') {
      result = result.filter(t => t.isLowBudget);
    }

    // sort
    if (this.sortOption === 'Name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortOption === 'Budget High-Low') {
      result.sort((a, b) => b.budget - a.budget);
    } else if (this.sortOption === 'Remaining High-Low') {
      result.sort((a, b) => b.remainingBudget - a.remainingBudget);
    }

    this.filteredTeams = result;
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    this.applyFilters();
  }

  openModal(team?: any) {
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  async addTeam() {
    const tId = this.tournamentId || (this.allTournaments.length > 0 ? this.allTournaments[0].id : null);
    if (!tId) {
      alert('No tournament selected to add team');
      return;
    }

    try {
      const payload = { ...this.newTeam, remainingBudget: this.newTeam.budget };
      await this.tournamentService.addTeam(tId.toString(), payload);
      this.closeModal();
      this.newTeam = { name: '', code: '', budget: 100000000 };
      if (this.isAllTeamsMode) {
        this.loadAllTeams();
      } else {
        this.loadSingleTournamentTeams();
      }
    } catch (err: any) {
      console.error('Error adding team:', err);
      alert('Failed to add team');
    }
  }

  getDotColor(index: number) {
    const colors = ['pink', 'green', 'blue', 'purple', 'orange'];
    return colors[index % colors.length];
  }

  formatPriceForCr(amount: number) {
    if (!amount) return '0';
    return (amount / 10000000).toFixed(0);
  }
}
