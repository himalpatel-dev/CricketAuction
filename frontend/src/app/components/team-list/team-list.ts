import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './team-list.html',
  styleUrls: ['./team-list.css']
})
export class TeamListComponent implements OnInit {
  tournamentId: string | null = null;
  tournament: any = null;
  loading = true;
  showModal = false;

  newTeam = { name: '', code: '', budget: 100000000 };
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

    // Dynamic back link
    if (this.authService.isTournamentAdmin()) {
      this.backLink = `/tournament-detail/${user.tournamentId}`;
    } else {
      this.backLink = `/tournament-detail/${this.tournamentId}`;
    }

    if (this.tournamentId) {
      this.loadTeams();
    }
  }

  async loadTeams() {
    if (!this.tournamentId) return;
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(this.tournamentId);
    } catch (err: any) {
      console.error('Error loading teams:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openModal() {
    console.log('DEBUG: openModal called. Current state:', this.showModal);
    this.showModal = true;
    console.log('DEBUG: showModal set to true. New state:', this.showModal);
    this.cdr.detectChanges();
  }

  closeModal() {
    console.log('DEBUG: closeModal called');
    this.showModal = false;
    this.cdr.detectChanges();
  }

  async addTeam() {
    if (!this.tournamentId) return;
    try {
      const payload = { ...this.newTeam, remainingBudget: this.newTeam.budget };
      await this.tournamentService.addTeam(this.tournamentId, payload);
      this.closeModal();
      this.newTeam = { name: '', code: '', budget: 100000000 };
      this.loadTeams();
    } catch (err: any) {
      console.error('Error adding team:', err);
      alert('Failed to add team');
    }
  }

  formatPrice(amount: number) {
    if (!amount) return '0';
    if (amount >= 10000000) return (amount / 10000000).toFixed(2) + ' Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(2) + ' L';
    return amount.toLocaleString();
  }
}
