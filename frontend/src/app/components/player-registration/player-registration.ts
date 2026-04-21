import { Component, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
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

  isDropdownOpen = false;
  selectedTournamentName = 'Choose an active tournament';

  isRoleDropdownOpen = false;
  isTshirtDropdownOpen = false;
  isGenderDropdownOpen = false;
  isCalendarOpen = false;

  calendarDate: Date = new Date();
  calendarDays: any[] = [];
  calendarMonthYear: string = '';
  weekDays: string[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  currentStep = 1;
  totalSteps = 3;

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
      const file = event.target.files[0];
      
      // Check file size (2MB = 2 * 1024 * 1024 bytes)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size is more than 2MB. Please select a smaller file.');
        if (this.photoInput) this.photoInput.nativeElement.value = '';
        return;
      }

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
        const first = this.tournaments[0];
        this.selectedTournamentId = first.id;
        this.selectedTournamentName = `${first.name} (${first.status})`;
        this.updateBasePrice();
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      this.message = 'Error loading tournaments. Please refresh.';
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectTournament(tournament: any) {
    this.selectedTournamentId = tournament.id;
    this.selectedTournamentName = `${tournament.name} (${tournament.status})`;
    this.isDropdownOpen = false;
    this.updateBasePrice();
  }

  // --- Custom Calendar Logic ---
  toggleCalendar() {
    this.isCalendarOpen = !this.isCalendarOpen;
    if (this.isCalendarOpen) {
      this.generateCalendar();
    }
  }

  generateCalendar() {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    this.calendarMonthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.calendarDate);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust for Monday start (0 is Sunday in JS, we want 0 for Monday)
    let startingDay = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, current: false });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, current: true });
    }

    // Next month padding
    const totalSlots = 42; // 6 rows
    const nextPadding = totalSlots - days.length;
    for (let i = 1; i <= nextPadding; i++) {
      days.push({ day: i, current: false });
    }

    this.calendarDays = days;
  }

  changeMonth(delta: number) {
    this.calendarDate.setMonth(this.calendarDate.getMonth() + delta);
    this.generateCalendar();
  }

  selectDate(day: number, isCurrent: boolean) {
    if (!isCurrent) return;
    const year = this.calendarDate.getFullYear();
    const month = String(this.calendarDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    this.player.dob = `${year}-${month}-${d}`;
    this.isCalendarOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown') && !target.closest('.date-input-wrapper')) {
      this.isDropdownOpen = false;
      this.isRoleDropdownOpen = false;
      this.isTshirtDropdownOpen = false;
      this.isGenderDropdownOpen = false;
      this.isCalendarOpen = false;
    }
  }

  toggleRoleDropdown() { this.isRoleDropdownOpen = !this.isRoleDropdownOpen; }
  selectRole(role: string) {
    this.player.role = role;
    this.isRoleDropdownOpen = false;
  }

  toggleTshirtDropdown() { this.isTshirtDropdownOpen = !this.isTshirtDropdownOpen; }
  selectTshirt(size: string) {
    this.player.tShirtSize = size;
    this.isTshirtDropdownOpen = false;
  }

  toggleGenderDropdown() { this.isGenderDropdownOpen = !this.isGenderDropdownOpen; }
  selectGender(gender: string) {
    this.player.gender = gender;
    this.isGenderDropdownOpen = false;
  }

  onTournamentChange() {
    this.updateBasePrice();
  }

  updateBasePrice() {
    const selected = this.tournaments.find(t => String(t.id) === String(this.selectedTournamentId));
    if (selected) {
      this.basePrice = selected.minimumPlayerBasePrice;
      this.player.basePrice = this.basePrice;
    }
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  setStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!this.player.name || !this.player.dob || !this.player.mobileNo) {
      this.message = 'Please fill in all required fields (Name, Mobile No, Date of Birth).';
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

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
