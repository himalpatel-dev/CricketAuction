import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';

@Component({
  selector: 'app-player-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './player-registration.html',
  styleUrls: ['./player-registration.css']
})
export class PlayerRegistrationComponent {
  player: any = {
    name: '',
    role: 'Batsman',
    basePrice: 0,
    mobileNo: '',
    dob: '',
    gender: 'Male',
    tShirtSize: '',
    trouserSize: '',
    city: ''
  };

  loading = false;
  message = '';
  success = false;

  tournaments: any[] = [];
  selectedTournamentId: any = '';
  basePrice = 0;

  constructor(
    private router: Router,
    private tournamentService: TournamentService
  ) {
    this.fetchOpenTournaments();
  }

  async fetchOpenTournaments() {
    try {
      const res = await this.tournamentService.getOpenTournaments();
      this.tournaments = res;
      if (this.tournaments.length > 0) {
        // Select first one by default
        this.selectedTournamentId = this.tournaments[0].id;
        this.updateBasePrice();
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      this.message = 'Error loading tournaments. Please refresh.';
    }
  }

  onTournamentChange() {
    this.updateBasePrice();
  }

  updateBasePrice() {
    const selected = this.tournaments.find(t => String(t.id) === String(this.selectedTournamentId));
    if (selected) {
      this.basePrice = selected.baseAuctionPrice;
      this.player.basePrice = this.basePrice;
    }
  }

  async register() {
    if (this.loading) return;

    this.loading = true;
    this.message = '';

    if (!this.selectedTournamentId) {
      this.message = 'Please select a tournament.';
      this.loading = false;
      return;
    }

    try {
      this.player.basePrice = this.basePrice;
      const payload = { ...this.player, tournamentId: this.selectedTournamentId };

      await this.tournamentService.registerPlayer(payload);

      this.success = true;
      this.message = 'Registration successful! Redirecting to login...';
      setTimeout(() => this.router.navigate(['/login']), 2000);
    } catch (err: any) {
      console.error('Registration Error:', err);
      this.success = false;
      this.message = err.error?.message || 'Registration failed. Please try again.';
      this.loading = false;
    }
  }
}
