import { Component, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ImageService } from '../../services/image.service';
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

  months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  years: number[] = [];
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();

  // Image Cropper State
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper = false;
  isCropperLoading = false;

  @ViewChild('photoInput') photoInput!: ElementRef;
  @ViewChild(ImageCropperComponent) cropper!: ImageCropperComponent;

  get playerImageUrl(): any {
    return this.imageService.getPlayerImageUrl(this.player.image);
  }

  loading = false;
  message = '';
  success = false;

  tournaments: any[] = [];
  selectedTournamentId: any = '';
  basePrice = 0;
  // When opened from a tournament, lock the tournament selection
  isTournamentFixed: boolean = false;
  preselectedTournamentId: any = null;

  get isFormValid(): boolean {
    return !!(
      this.player.name &&
      this.player.mobileNo &&
      this.player.mobileNo.length === 10 &&
      this.player.dob &&
      this.player.gender &&
      this.player.role &&
      this.player.tShirtSize &&
      this.player.trouserSize &&
      this.player.city &&
      this.player.image &&
      this.selectedTournamentId
    );
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    private imageService: ImageService,
    private cdr: ChangeDetectorRef
  ) {
    // Read query params first, then load tournaments so we can preselect and lock if requested
    this.route.queryParams.subscribe(params => {
      if (params['tournamentId']) {
        this.preselectedTournamentId = params['tournamentId'];
        this.isTournamentFixed = true;
      }
      if (params['fromTournament']) this.isTournamentFixed = (params['fromTournament'] === 'true' || params['fromTournament'] === true);
      this.fetchOpenTournaments();
    });
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 60; i <= currentYear + 5; i++) {
      this.years.push(i);
    }
    this.years.reverse();
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
    console.log('imageCropped event fired', {
      hasBase64: !!event.base64,
      hasBlob: !!event.blob,
      hasObjectUrl: !!event.objectUrl
    });

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
    console.log('Confirming crop. croppedImage length:', this.croppedImage?.length);
    // Manual fallback
    if (!this.croppedImage && this.cropper) {
      const manual = this.cropper.crop();
      if (manual && manual.base64) {
        this.croppedImage = manual.base64;
      }
    }

    if (this.croppedImage) {
      this.player.image = this.croppedImage;
      console.log('Image assigned to player. Starts with:', this.player.image.substring(0, 30));
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
        // If a tournament was passed via query param, try to preselect it
        if (this.preselectedTournamentId) {
          const found = this.tournaments.find(t => String(t.id) === String(this.preselectedTournamentId));
          if (found) {
            this.selectedTournamentId = found.id;
            this.selectedTournamentName = `${found.name} (${found.status})`;
            this.updateBasePrice();
            // keep dropdown closed when opened from tournament link
            if (this.isTournamentFixed) this.isDropdownOpen = false;
            return;
          }
        }

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
    if (this.isTournamentFixed) return;
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectTournament(tournament: any) {
    if (this.isTournamentFixed) return;
    this.selectedTournamentId = tournament.id;
    this.selectedTournamentName = `${tournament.name} (${tournament.status})`;
    this.isDropdownOpen = false;
    this.updateBasePrice();
  }

  // --- Custom Calendar Logic ---
  toggleCalendar() {
    this.isCalendarOpen = !this.isCalendarOpen;
    if (this.isCalendarOpen) {
      if (this.player.dob && !isNaN(new Date(this.player.dob).getTime())) {
        this.calendarDate = new Date(this.player.dob);
      } else {
        this.calendarDate = new Date();
      }
      this.generateCalendar();
    }
  }

  generateCalendar() {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    this.calendarMonthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.calendarDate);

    this.selectedMonth = month;
    this.selectedYear = year;

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

  onMonthYearChange() {
    this.calendarDate.setFullYear(this.selectedYear);
    this.calendarDate.setMonth(this.selectedMonth);
    this.generateCalendar();
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
    if (!target.closest('.custom-dropdown') && !target.closest('.date-input-wrapper') && !target.closest('.custom-calendar-popup')) {
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

  numberOnly(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  async onMobileChange() {
    if (this.player.mobileNo && this.player.mobileNo.length === 10) {
      try {
        const existing = await this.tournamentService.checkPlayerByMobile(this.player.mobileNo);
        if (existing) {
          // Merge existing data into the current player object
          // We keep the current tournamentId but update personal/professional details
          this.player = {
            ...this.player,
            ...existing,
            // Format DOB for the form if it comes as a full date string
            dob: existing.dob ? existing.dob.split('T')[0] : ''
          };

          this.message = `Welcome back, ${existing.name}! We've pre-filled your details.`;
          this.success = true;

          // Clear message after some time
          setTimeout(() => {
            if (this.success) {
              this.message = '';
              this.cdr.detectChanges();
            }
          }, 5000);

          this.cdr.detectChanges();
        }
      } catch (err) {
        // 404 is expected for new players, just ignore
        console.log('New player or error checking mobile:', err);
      }
    }
  }

  private blobUrlToBase64(blobUrl: string): Promise<string> {
    return this.imageService.blobUrlToBase64(blobUrl);
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

      // Ensure we don't send blob URLs to backend
      if (this.player.image && this.player.image.startsWith('blob:')) {
        console.log('Converting blob URL to base64 before upload...');
        try {
          this.player.image = await this.blobUrlToBase64(this.player.image);
          console.log('Conversion successful. Length:', this.player.image.length);
        } catch (blobErr) {
          console.error('Failed to convert blob to base64:', blobErr);
        }
      }

      const payload = { ...this.player, tournamentId: this.selectedTournamentId };
      console.log('Registering player with payload:', { ...payload, image: payload.image ? 'IMAGE_DATA' : 'NONE' });

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
