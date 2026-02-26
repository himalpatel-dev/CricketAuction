import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-squad-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './squad-view.html',
  styleUrl: './squad-view.css'
})
export class SquadViewComponent implements OnInit {
  tournament: any = null;
  loading = true;
  backLink = '/admin'; // Default

  constructor(
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadData(id);
    }

    // Check role for back link
    if (this.authService.isTeam()) {
      this.backLink = '/team-dashboard';
    } else {
      // If admin, go to detail page usually, or admin dashboard
      this.backLink = `/tournament-detail/${id}`;
    }
  }

  async loadData(id: string) {
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(id);
      console.log('Squad Data Loaded:', this.tournament);
    } catch (err: any) {
      console.error('Error loading squads:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  formatPrice(amount: number) {
    if (!amount) return '0';
    if (amount >= 10000000) return (amount / 10000000).toFixed(2) + ' Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(2) + ' L';
    return amount.toLocaleString();
  }
}
