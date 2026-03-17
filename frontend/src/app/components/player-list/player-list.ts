import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

import { PlayerCardComponent } from '../player-card/player-card.component';

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PlayerCardComponent],
  templateUrl: './player-list.html',
  styleUrls: ['./player-list.css']
})
export class PlayerListComponent implements OnInit {
  tournamentId: string | null = null;
  tournament: any = null;
  tournaments: any[] = [];
  loading = true;

  showModal = false;
  newPlayer: any = {
    name: '',
    role: 'Batsman',
    basePrice: 1000000,
    mobileNo: '',
    dob: '',
    gender: 'Male',
    tShirtSize: '',
    trouserSize: ''
  };

  searchTerm = '';
  roleFilter = 'All';
  statusFilter = 'All';
  sortFilter = 'name-asc';
  viewMode = 'grid';

  filteredPlayers: any[] = [];
  stats = {
    total: 0,
    sold: 0,
    unsold: 0,
    upcoming: 0,
    highestSale: 0
  };

  backLink = '';

  constructor(
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.tournamentId = this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();

    // Set dynamic back link
    if (this.authService.isTournamentAdmin()) {
      this.backLink = `/tournament-detail/${user.tournamentId}`;
    } else {
      this.backLink = `/tournament-detail/${this.tournamentId}`;
    }

    if (this.tournamentId) {
      this.loadPlayers();
    }
    // load list of tournaments for the pills row
    this.loadTournaments();
  }

  async loadTournaments() {
    try {
      this.tournaments = await this.tournamentService.getAll();
    } catch (err) {
      console.warn('Failed to load tournaments for selector', err);
      this.tournaments = [];
    }
  }

  async selectTournament(id: string | number | null) {
    // clicking a tournament pill will switch the current tournament and reload players
    this.tournamentId = id ? String(id) : null;
    if (this.tournamentId) {
      await this.loadPlayers();
    } else {
      // if user selects "All Tournaments" we clear the current tournament view
      this.tournament = null;
      this.filteredPlayers = [];
      this.stats = { total: 0, sold: 0, unsold: 0, upcoming: 0, highestSale: 0 };
    }
    this.cdr.detectChanges();
  }

  async loadPlayers() {
    if (!this.tournamentId) return;
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(this.tournamentId);
      this.calculateStats();
      this.applyFilters();
    } catch (err: any) {
      console.error('Error loading players:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  calculateStats() {
    if (!this.tournament?.players) return;
    const players = this.tournament.players;
    this.stats.total = players.length;
    this.stats.sold = players.filter((p: any) => p.status === 'SOLD').length;
    this.stats.unsold = players.filter((p: any) => p.status === 'UNSOLD').length;
    this.stats.upcoming = players.filter((p: any) => p.status === 'UPCOMING').length;
    this.stats.highestSale = players.reduce((max: number, p: any) => Math.max(max, p.soldPrice || 0), 0);
  }

  applyFilters() {
    if (!this.tournament?.players) return;
    let players = [...this.tournament.players];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      players = players.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.role.toLowerCase().includes(term)
      );
    }

    if (this.roleFilter !== 'All') {
      let roleMap: any = {
        'Bat': 'Batsman',
        'Bowl': 'Bowler',
        'AR': 'All-Rounder',
        'WK': 'Wicketkeeper'
      };
      const searchRole = roleMap[this.roleFilter] || this.roleFilter;
      players = players.filter(p => p.role === searchRole);
    }

    if (this.statusFilter !== 'All') {
      const searchStatus = this.statusFilter === 'Pending' ? 'UPCOMING' : this.statusFilter;
      players = players.filter(p => p.status === searchStatus);
    }

    players.sort((a, b) => {
      switch (this.sortFilter) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'base-asc': return (a.basePrice || 0) - (b.basePrice || 0);
        case 'base-desc': return (b.basePrice || 0) - (a.basePrice || 0);
        case 'price-desc': return (b.soldPrice || 0) - (a.soldPrice || 0);
        default: return 0;
      }
    });

    this.filteredPlayers = players;
  }

  setRoleFilter(role: string) {
    this.roleFilter = role;
    this.applyFilters();
  }

  setStatusFilter(status: string) {
    this.statusFilter = status;
    this.applyFilters();
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onSort(event: any) {
    this.sortFilter = event.target.value;
    this.applyFilters();
  }

  setViewMode(mode: string) {
    this.viewMode = mode;
  }

  openModal() {
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  async addPlayer() {
    if (!this.tournamentId) return;
    try {
      const payload = { ...this.newPlayer };
      // Sanitize payload
      if (!payload.mobileNo) payload.mobileNo = null;
      if (!payload.tShirtSize) payload.tShirtSize = null;
      if (!payload.trouserSize) payload.trouserSize = null;

      await this.tournamentService.addPlayer(this.tournamentId, payload);
      this.closeModal();
      this.newPlayer = {
        name: '',
        role: 'Batsman',
        basePrice: 1000000,
        mobileNo: '',
        dob: '',
        gender: 'Male',
        tShirtSize: '',
        trouserSize: ''
      };
      this.loadPlayers();
    } catch (err: any) {
      console.error('Error adding player:', err);
      alert('Failed to add player');
    }
  }

  async onFileSelected(event: any) {
    if (!this.tournamentId) return;
    const file = event.target.files[0];
    if (file) {
      try {
        await this.tournamentService.uploadPlayers(this.tournamentId, file);
        alert('Players uploaded successfully!');
        this.loadPlayers();
      } catch (err: any) {
        console.error('Error uploading players:', err);
        alert('Failed to upload players.');
      }
    }
  }

  formatPrice(amount: number) {
    if (!amount) return '0';
    if (amount >= 10000000) return (amount / 10000000).toFixed(0).replace(/\.0$/, '') + 'Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(0).replace(/\.0$/, '') + 'L';
    return amount.toLocaleString();
  }
}
