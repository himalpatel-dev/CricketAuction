import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TopNavComponent } from '../top-nav/top-nav';

@Component({
  selector: 'app-add-tournament',
  standalone: true,
  imports: [CommonModule, FormsModule, TopNavComponent],
  templateUrl: './add-tournament.html',
  styleUrl: './add-tournament.css'
})
export class AddTournamentComponent {
  tournamentData = {
    name: '',
    tournamentStartDate: '',
    tournamentEndDate: '',
    matchStartDate: '',
    matchEndDate: '',
    regStartDate: '',
    regEndDate: '',
    auctionDate: '',
    totalPlayers: 100,
    playersPerTeam: 15,
    minimumPlayerBasePrice: 500000,
    competitionFactor: 1.5,
    format: 'T20',
    category: 'Franchise League',
    status: 'UPCOMING'
  };

  loading = false;
  error = '';

  constructor(
    private tournamentService: TournamentService,
    private router: Router
  ) { }

  async onSubmit() {
    this.loading = true;
    this.error = '';

    // Calculate status based on tournamentStartDate
    if (this.tournamentData.tournamentStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const startDate = new Date(this.tournamentData.tournamentStartDate);
      
      if (startDate > today) {
        this.tournamentData.status = 'UPCOMING';
      } else {
        this.tournamentData.status = 'ACTIVE';
      }
    }

    try {
      await this.tournamentService.create(this.tournamentData);
      this.router.navigate(['/tournaments']);
    } catch (err: any) {
      console.error('Create Tournament Error:', err);
      this.error = 'Failed to create tournament. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  getProjectedBudget(): number {
    if (!this.tournamentData) return 0;
    const p = Number(this.tournamentData.playersPerTeam || 0);
    const m = Number(this.tournamentData.minimumPlayerBasePrice || 0);
    const c = Number(this.tournamentData.competitionFactor || 0);
    const budget = Math.round(p * m * c);
    return isNaN(budget) ? 0 : budget;
  }

  cancel() {
    this.router.navigate(['/tournaments']);
  }
}
