import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../../services/tournament.service';

@Component({
  selector: 'app-player-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './player-registration.html',
  styleUrls: ['./player-registration.css']
})
export class PlayerRegistrationComponent {
  player = {
    name: '',
    role: 'Batsman',
    basePrice: 200000,
    mobileNo: '',
    dob: null,
    gender: 'Male',
    tShirtSize: '',
    trouserSize: ''
  };

  loading = false;
  message = '';
  success = false;

  // URL to backend registration endpoint (without authentication)
  private registerUrl = 'http://127.0.0.1:5001/api/tournaments/register-player';
  private openTournamentsUrl = 'http://127.0.0.1:5001/api/tournaments/open-tournaments';

  tournaments: any[] = [];
  selectedTournamentId: any = '';
  basePrice = 0;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {
    this.fetchOpenTournaments();
  }

  fetchOpenTournaments() {
    this.http.get<any[]>(this.openTournamentsUrl).subscribe({
      next: (res: any[]) => {
        this.tournaments = res;
        if (this.tournaments.length > 0) {
          // Select first one by default
          this.selectedTournamentId = this.tournaments[0].id;
          this.updateBasePrice();
        }
      },
      error: (err) => {
        console.error('Error fetching tournaments:', err);
        this.message = 'Error loading tournaments.';
      }
    });
  }

  onTournamentChange() {
    this.updateBasePrice();
  }

  updateBasePrice() {
    const selected = this.tournaments.find(t => t.id == this.selectedTournamentId);
    if (selected) {
      this.basePrice = selected.baseAuctionPrice;
      this.player.basePrice = this.basePrice;
    }
  }

  register() {
    this.loading = true;
    this.message = '';

    if (!this.selectedTournamentId) {
      this.message = 'Please select a tournament.';
      this.loading = false;
      return;
    }

    // Ensure base price is sent correctly (though backend logic handles it too)
    this.player.basePrice = this.basePrice;

    // Add tournament ID to payload
    const payload = { ...this.player, tournamentId: this.selectedTournamentId };

    // Call backend
    this.http.post(this.registerUrl, payload)
      .subscribe({
        next: (res: any) => {
          this.success = true;
          this.message = 'Registration successful! Redirecting to login...';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: any) => {
          this.success = false;
          this.message = err.error?.message || 'Registration failed. Please try again.';
          this.loading = false;
        }
      });
  }
}
