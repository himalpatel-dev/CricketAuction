import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';
import { TopNavComponent } from '../top-nav/top-nav';
import { TeamCardComponent } from '../team-card/team-card.component';
import { PlayerCardComponent } from '../player-card/player-card.component';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TopNavComponent, TeamCardComponent, PlayerCardComponent],
  templateUrl: './tournament-detail.html',
  styleUrl: './tournament-detail.css'
})
export class TournamentDetailComponent implements OnInit {
  tournament: any = null;
  tournaments: any[] = [];
  loading = true;
  currentTab: string = 'Overview';
  adminName: string = '';
  showTournamentsList: boolean = true;
  processedTeams: any[] = [];
  searchTerm: string = '';
  playerSearchTerm: string = '';
  saving = false;

  stats = {
    playersSold: 0,
    totalSpent: 0,
    registeredTeams: 0,
    avgSoldPrice: 0,
    highestBid: 0,
    highestBidder: 'N/A',
    battingCount: 0,
    bowlingCount: 0,
    arCount: 0,
    wkCount: 0,
    unsoldPlayers: 0,
    remainingPlayers: 0,
    auctionRounds: 2,
    totalRounds: 5
  };

  budgetStats = {
    totalPool: 0,
    totalSpent: 0,
    remainingPool: 0,
    spentPercentage: 0
  };

  teamBudgets: any[] = [];

  recentActivity: any[] = [];
  timeline: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    const user = this.authService.getUser();
    const tournamentId = this.route.snapshot.paramMap.get('id');

    if (!this.authService.isAdmin() && !this.authService.isTournamentAdmin()) {
      if (this.authService.isTeam()) {
        this.router.navigate(['/team-dashboard']);
      } else {
        this.router.navigate(['/login']);
      }
      return;
    }

    this.adminName = user?.username || 'Admin';

    if (this.authService.isTournamentAdmin()) {
      if (String(user.tournamentId) !== String(tournamentId)) {
        this.router.navigate(['/tournament-detail', user.tournamentId]);
        return;
      }
    }

    if (tournamentId) {
      this.loadTournament(tournamentId);
    }
  }

  async loadTournament(id: string) {
    this.loading = true;
    try {
      const [detail, all] = await Promise.all([
        this.tournamentService.getById(id),
        this.tournamentService.getAll()
      ]);
      this.tournament = detail;
      this.computeAndSetStatus();
      this.buildTimeline();
      this.tournaments = all || [];
      this.processTeams();
      this.calculateLocalStats();
      this.processBudgetTab();
    } catch (err: any) {
      console.error('Error loading tournament:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  processBudgetTab() {
    if (!this.tournament || !this.tournament.teams) return;

    const teams = this.tournament.teams;
    const players = this.tournament.players || [];

    let totalPool = 0;
    let totalSpent = 0;

    this.teamBudgets = teams.map((team: any) => {
      const bBought = players.filter((p: any) => p.soldTo === team.id && p.status === 'SOLD');
      const spent = bBought.reduce((sum: number, p: any) => sum + (p.soldPrice || 0), 0);
      const balance = team.budget - spent;
      const usedPercentage = (spent / team.budget) * 100;

      totalPool += team.budget;
      totalSpent += spent;

      return {
        ...team,
        ownerName: team.ownerName || 'Admin',
        amountSpent: spent,
        balanceLeft: balance,
        playersBoughtCount: bBought.length,
        usedPercentage: usedPercentage,
        boughtPlayers: bBought.slice(0, 3).map((p: any) => ({
          name: p.name,
          role: p.role,
          price: p.soldPrice,
          initials: p.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
        }))
      };
    });

    this.budgetStats = {
      totalPool: totalPool,
      totalSpent: totalSpent,
      remainingPool: totalPool - totalSpent,
      spentPercentage: (totalSpent / totalPool) * 100
    };
  }

  processTeams() {
    if (!this.tournament || !this.tournament.teams) return;

    this.processedTeams = this.tournament.teams.map((team: any) => {
      const teamPlayers = this.tournament.players?.filter((p: any) => p.soldTo === team.id && p.status === 'SOLD') || [];
      return {
        ...team,
        tournamentName: this.tournament.name,
        tournamentId: this.tournament.id,
        ownerName: team.ownerName || 'Admin',
        playersCount: teamPlayers.length,
        batsmenCount: teamPlayers.filter((p: any) => p.role === 'Batsman').length,
        bowlersCount: teamPlayers.filter((p: any) => p.role === 'Bowler').length,
        arCount: teamPlayers.filter((p: any) => p.role === 'All-Rounder').length,
        wkCount: teamPlayers.filter((p: any) => p.role === 'Wicketkeeper').length,
        isActive: this.tournament.status === 'ACTIVE',
        isLowBudget: team.remainingBudget < (team.budget * 0.2)
      };
    });
  }

  get filteredTeams() {
    if (!this.processedTeams) return [];
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (!term) return this.processedTeams;

    return this.processedTeams.filter(team =>
      team?.name?.toLowerCase().includes(term)
    );
  }

  get filteredPlayers() {
    if (!this.tournament?.players) return [];
    if (!this.playerSearchTerm.trim()) return this.tournament.players;
    const term = this.playerSearchTerm.toLowerCase();
    return this.tournament.players.filter((player: any) =>
      player.name.toLowerCase().includes(term) ||
      player.role?.toLowerCase().includes(term) ||
      player.city?.toLowerCase().includes(term)
    );
  }

  calculateLocalStats() {
    if (!this.tournament) return;

    const players = this.tournament.players || [];
    const teams = this.tournament.teams || [];

    let totalSpent = 0;
    let soldCount = 0;
    let highestBid = 0;
    let highestBidder = 'N/A';

    let bat = 0, bwl = 0, ar = 0, wk = 0;
    let unsold = 0;
    let upcoming = 0;

    players.forEach((p: any) => {
      if (p.status === 'SOLD') {
        soldCount++;
        totalSpent += p.soldPrice;
        if (p.soldPrice > highestBid) {
          highestBid = p.soldPrice;
          highestBidder = p.name;
        }

        if (p.role === 'Batsman') bat++;
        else if (p.role === 'Bowler') bwl++;
        else if (p.role === 'All-Rounder') ar++;
        else if (p.role === 'Wicketkeeper') wk++;
      } else if (p.status === 'UNSOLD') {
        unsold++;
      } else {
        upcoming++;
      }
    });

    this.stats = {
      ...this.stats,
      playersSold: soldCount,
      totalSpent: totalSpent,
      registeredTeams: teams.length,
      avgSoldPrice: soldCount > 0 ? totalSpent / soldCount : 0,
      highestBid: highestBid,
      highestBidder: highestBidder,
      battingCount: bat,
      bowlingCount: bwl,
      arCount: ar,
      wkCount: wk,
      unsoldPlayers: unsold,
      remainingPlayers: upcoming
    };

    this.recentActivity = players
      .filter((p: any) => p.status === 'SOLD')
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 50)
      .map((p: any) => ({
        name: p.name,
        team: teams.find((t: any) => t.id === p.soldTo)?.name || 'Unknown',
        price: p.soldPrice,
        code: p.name[0]
      }));
  }

  setTab(tab: string) {
    this.currentTab = tab;
    this.cdr.detectChanges();
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

  async updateTournamentDetails() {
    if (!this.tournament || this.saving) return;
    this.saving = true;
    try {
      this.computeAndSetStatus();
      await this.tournamentService.update(this.tournament.id, this.tournament);
      alert('Tournament updated successfully!');
      this.setTab('Overview');
      await this.loadTournament(this.tournament.id.toString());
    } catch (err: any) {
      console.error('Error updating tournament:', err);
      alert('Failed to update tournament');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  computeAndSetStatus() {
    if (!this.tournament) return;
    const now = new Date();
    const start = this.tournament.tournamentStartDate ? new Date(this.tournament.tournamentStartDate) : null;
    const end = this.tournament.tournamentEndDate ? new Date(this.tournament.tournamentEndDate) : null;
    let status = this.tournament.status || 'UPCOMING';

    if (start && end) {
      if (now < start) status = 'UPCOMING';
      else if (now >= start && now <= end) status = 'ACTIVE';
      else status = 'COMPLETED';
    } else if (start && !end) {
      status = now < start ? 'UPCOMING' : 'ACTIVE';
    } else if (!start && end) {
      status = now <= end ? 'ACTIVE' : 'COMPLETED';
    }

    this.tournament.status = status;
  }

  private formatDateLabel(date: Date | null) {
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private statusForRange(start: Date | null, end: Date | null) {
    const now = new Date();
    if (start && end) {
      if (now < start) return 'UPCOMING';
      if (now >= start && now <= end) return 'IN PROGRESS';
      return 'COMPLETED';
    }
    if (start && !end) return now < start ? 'UPCOMING' : 'IN PROGRESS';
    if (!start && end) return now <= end ? 'IN PROGRESS' : 'COMPLETED';
    return 'UPCOMING';
  }

  private statusForDate(d: Date | null) {
    if (!d) return 'UPCOMING';
    const now = new Date();
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    if (now < startOfDay) return 'UPCOMING';
    if (now >= startOfDay && now <= endOfDay) return 'IN PROGRESS';
    return 'COMPLETED';
  }

  buildTimeline() {
    if (!this.tournament) {
      this.timeline = [];
      return;
    }

    const tStart = this.tournament.tournamentStartDate ? new Date(this.tournament.tournamentStartDate) : null;
    const tEnd = this.tournament.tournamentEndDate ? new Date(this.tournament.tournamentEndDate) : null;
    const regStart = this.tournament.regStartDate ? new Date(this.tournament.regStartDate) : null;
    const regEnd = this.tournament.regEndDate ? new Date(this.tournament.regEndDate) : null;
    const auction = this.tournament.auctionDate ? new Date(this.tournament.auctionDate) : null;
    const mStart = this.tournament.matchStartDate ? new Date(this.tournament.matchStartDate) : null;
    const mEnd = this.tournament.matchEndDate ? new Date(this.tournament.matchEndDate) : null;

    const timeline: any[] = [];

    // 1. Tournament Start
    timeline.push({
      label: 'Tournament Start',
      date: this.formatDateLabel(tStart),
      status: this.statusForDate(tStart),
      type: 'tournament',
      position: 'top'
    });

    // 2. Registration (Range)
    const regStatus = this.statusForRange(regStart, regEnd);
    timeline.push({
      label: 'Registration',
      date: regStart && regEnd ? `${this.formatDateShort(regStart)} → ${this.formatDateShort(regEnd)}` : this.formatDateLabel(regStart),
      status: regStatus,
      type: 'registration',
      position: 'bottom'
    });

    // 3. Auction
    timeline.push({
      label: 'Auction',
      date: this.formatDateLabel(auction),
      status: this.statusForDate(auction),
      type: 'auction',
      position: 'top'
    });

    // 4. Match (Range)
    const matchStatus = this.statusForRange(mStart, mEnd);
    timeline.push({
      label: 'Match',
      date: mStart && mEnd ? `${this.formatDateShort(mStart)} → ${this.formatDateShort(mEnd)}` : this.formatDateLabel(mStart),
      status: matchStatus,
      type: 'match',
      position: 'bottom'
    });

    // 5. Tournament End
    timeline.push({
      label: 'Tournament End',
      date: this.formatDateLabel(tEnd),
      status: this.statusForDate(tEnd),
      type: 'tournament-end',
      position: 'top'
    });

    this.timeline = timeline;
  }

  private formatDateShort(date: Date | null) {
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  startAuction() {
    this.router.navigate(['/auction', this.tournament.id]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
