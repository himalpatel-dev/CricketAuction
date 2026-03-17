import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';
import { TopNavComponent } from '../top-nav/top-nav';

@Component({
  selector: 'app-tournament-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TopNavComponent],
  templateUrl: './tournament-list.html',
  styleUrl: './tournament-list.css'
})
export class TournamentListComponent implements OnInit {
  tournaments: any[] = [];
  filteredTournaments: any[] = [];
  loading = true;
  searchTerm: string = '';
  activeTab: string = 'All';
  adminName: string = '';
  showTournamentsList: boolean = true;

  stats = {
    total: 0,
    active: 0,
    upcoming: 0,
    completed: 0
  };

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
        this.applyFilters();
        this.calculateStats();
      }
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  calculateStats() {
    this.stats = {
      total: this.tournaments.length,
      active: this.tournaments.filter(t => t.status && t.status.toUpperCase() === 'ACTIVE').length,
      upcoming: this.tournaments.filter(t => t.status && t.status.toUpperCase() === 'UPCOMING').length,
      completed: this.tournaments.filter(t => t.status && t.status.toUpperCase() === 'COMPLETED').length
    };
  }

  applyFilters() {
    const term = (this.searchTerm || '').toLowerCase().trim();

    this.filteredTournaments = this.tournaments.filter(t => {
      const matchesSearch = !term ||
        t.name.toLowerCase().includes(term) ||
        (t.location && t.location.toLowerCase().includes(term));

      const matchesTab = this.activeTab === 'All' ||
        (t.status && t.status.toUpperCase() === this.activeTab.toUpperCase());

      return matchesSearch && matchesTab;
    });
    this.cdr.detectChanges();
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.applyFilters();
  }

  onSearch() {
    this.applyFilters();
  }

  formatCurrency(value: number): string {
    if (!value) return '0';
    if (value >= 10000000) return (value / 10000000).toFixed(1) + 'Cr';
    if (value >= 100000) return (value / 100000).toFixed(0) + 'L';
    return value.toLocaleString('en-IN');
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
