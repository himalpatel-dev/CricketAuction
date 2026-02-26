import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './player-list.html',
  styleUrls: ['./player-list.css']
})
export class PlayerListComponent implements OnInit {
  tournamentId: string | null = null;
  tournament: any = null;
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
  }

  async loadPlayers() {
    if (!this.tournamentId) return;
    this.loading = true;
    try {
      this.tournament = await this.tournamentService.getById(this.tournamentId);
    } catch (err: any) {
      console.error('Error loading players:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
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
      if (!payload.dob) payload.dob = null;
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
    if (amount >= 10000000) return (amount / 10000000).toFixed(2) + ' Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(2) + ' L';
    return amount.toLocaleString();
  }
}
