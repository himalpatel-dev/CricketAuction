import { Component, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { TournamentService } from '../../services/tournament.service';

@Component({
  selector: 'app-player-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ImageCropperComponent],
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
    city: '',
    image: ''
  };

  // Image Cropper State
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper = false;
  isCropperLoading = false;

  @ViewChild('photoInput') photoInput!: ElementRef;
  @ViewChild(ImageCropperComponent) cropper!: ImageCropperComponent;

  get playerImageUrl(): any {
    if (!this.player.image) return null;
    if (this.player.image.startsWith('data:')) {
      return this.sanitizer.bypassSecurityTrustUrl(this.player.image);
    }
    return this.player.image;
  }

  loading = false;
  message = '';
  success = false;

  tournaments: any[] = [];
  selectedTournamentId: any = '';
  basePrice = 0;

  constructor(
    private router: Router,
    private tournamentService: TournamentService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.fetchOpenTournaments();
  }

  onPlayerPhotoSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.isCropperLoading = true;
      this.imageChangedEvent = event;
      this.showCropper = true;
      this.croppedImage = ''; 
      
      // Safety timeout
      setTimeout(() => {
        if (this.isCropperLoading) {
          this.isCropperLoading = false;
          this.cdr.detectChanges();
        }
      }, 8000);
      
      this.cdr.detectChanges();
    }
  }

  imageCropped(event: any) {
    if (event.base64) {
      this.croppedImage = event.base64;
    } else if (event.objectUrl) {
      this.croppedImage = event.objectUrl;
    }
    this.isCropperLoading = false;
    this.cdr.detectChanges();
  }

  imageLoaded() {
    this.isCropperLoading = false;
    this.cdr.detectChanges();
  }

  cropperReady() {
    this.isCropperLoading = false;
    this.cdr.detectChanges();
  }

  loadImageFailed() {
    alert('Failed to load image. Please try another file.');
    this.showCropper = false;
    this.isCropperLoading = false;
    this.cdr.detectChanges();
  }

  cancelCrop() {
    this.showCropper = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
    if (this.photoInput) this.photoInput.nativeElement.value = '';
  }

  confirmCrop() {
    // Manual fallback
    if (!this.croppedImage && this.cropper) {
      const manual = this.cropper.crop();
      if (manual && manual.base64) {
        this.croppedImage = manual.base64;
      }
    }

    if (this.croppedImage) {
      this.player.image = this.croppedImage;
      this.showCropper = false;
      this.imageChangedEvent = '';
      if (this.photoInput) this.photoInput.nativeElement.value = '';
      this.cdr.detectChanges();
    } else {
      alert('The cropped image is not ready yet. Please try moving the crop box slightly or wait a second.');
    }
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
