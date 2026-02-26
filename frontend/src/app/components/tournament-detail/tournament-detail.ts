import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './tournament-detail.html',
  styleUrl: './tournament-detail.css'
})
export class TournamentDetailComponent implements OnInit {
  tournament: any = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Security check: Only admins can view this detail management page
    // Security check: Only admins or assigned tournament admins can view this page
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

    if (this.authService.isTournamentAdmin()) {
      if (String(user.tournamentId) !== String(tournamentId)) {
        // Redirect to their own tournament if trying to access another
        this.router.navigate(['/tournament-detail', user.tournamentId]);
        return;
      }
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTournament(id);
    }
  }

  async loadTournament(id: string) {
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(id);
      console.log('Tournament Details:', this.tournament);
    } catch (err: any) {
      console.error('Error loading tournament:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  startAuction() {
    console.log('Navigating to Auction:', this.tournament.id);
    this.router.navigate(['/auction', this.tournament.id]);
  }

  logout() {
    console.log('Logging out');
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
