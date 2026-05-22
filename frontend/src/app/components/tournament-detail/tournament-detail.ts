import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ImageService } from '../../services/image.service';
import { TournamentService } from '../../services/tournament.service';
import { AuthService } from '../../services/auth.service';
import { TopNavComponent } from '../top-nav/top-nav';
import { TeamCardComponent } from '../team-card/team-card.component';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage, CropperPosition } from 'ngx-image-cropper';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TopNavComponent, TeamCardComponent, PlayerCardComponent, ImageCropperComponent],
  templateUrl: './tournament-detail.html',
  styleUrl: './tournament-detail.css'
})
export class TournamentDetailComponent implements OnInit {
  tournament: any = null;
  tournaments: any[] = [];
  loading = true;
  currentTab: string = 'Overview';
  adminName: string = '';
  showTournamentsList: boolean = true;
  processedTeams: any[] = [];
  searchTerm: string = '';
  playerSearchTerm: string = '';
  saving = false;
  editingPlayerId: number | null = null;
  settingsError: string = '';
  dateErrors: { [key: string]: string } = {};

  @ViewChild('photoInput') photoInput!: ElementRef;

  showAddTeamForm = false;
  newTeam = {
    name: '',
    code: '',
    ownerName: '',
    email: '',
    logoUrl: ''
  };

  // Credentials Modal State
  showCredentialsModal = false;
  createdCredentials = {
    username: '',
    password: '',
    email: '',
    role: 'Team Owner'
  };
  copied = false;

  // Registration link modal state
  showRegistrationModal = false;
  registrationUrl: string = '';
  copiedRegistration = false;
  qrCodeUrl = '';

  showAddPlayerForm = false;
  newPlayer: any = {
    name: '',
    role: 'Batsman',
    basePrice: 0,
    mobileNo: '',
    dob: '',
    gender: 'Male',
    tShirtSize: '',
    trouserSize: '',
    image: ''
  };

  // Dropdown and Calendar State
  isRoleDropdownOpen = false;
  isTshirtDropdownOpen = false;
  isGenderDropdownOpen = false;
  isCategoryDropdownOpen = false;
  isFormatDropdownOpen = false;
  isCalendarOpen = false;
  activeDateField: string | null = null; // To track which date field is being edited

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

  @ViewChild(ImageCropperComponent) cropper!: ImageCropperComponent;

  // Global Player Database State
  showGlobalDatabase = false;
  globalPlayers: any[] = [];
  globalFilters = {
    search: '',
    role: 'All',
    city: ''
  };
  loadingGlobal = false;

  async toggleGlobalDatabase() {
    console.log('Toggling Global Database. Current state:', this.showGlobalDatabase);
    this.showGlobalDatabase = !this.showGlobalDatabase;

    if (this.showGlobalDatabase) {
      await this.loadGlobalPlayers();
    } else {
      // Refresh local players just in case
      this.onSearch();
    }
    this.cdr.detectChanges();
  }

  async loadGlobalPlayers() {
    this.loadingGlobal = true;
    try {
      const filters = {
        ...this.globalFilters,
        excludeTournamentId: this.tournament?.id
      };
      this.globalPlayers = await this.tournamentService.getGlobalPlayers(filters);
    } catch (err) {
      console.error('Error loading global players:', err);
    } finally {
      this.loadingGlobal = false;
      this.cdr.detectChanges();
    }
  }

  async addGlobalPlayerToTournament(player: any) {
    if (!confirm(`Are you sure you want to add ${player.name} to this tournament?`)) {
      return;
    }

    try {
      this.saving = true;
      const payload = {
        ...player,
        basePrice: this.tournament?.minimumPlayerBasePrice || 0,
        status: 'UPCOMING'
      };
      await this.tournamentService.addPlayer(this.tournament.id, payload);
      await this.loadTournament(this.tournament.id.toString(), true);
      alert(`${player.name} added successfully to this tournament!`);
      await this.loadGlobalPlayers(); // Refresh the list so the added player disappears
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async onDeletePlayer(player: any) {
    if (!confirm(`Are you sure you want to remove ${player.name} from this tournament?`)) {
      return;
    }

    try {
      this.saving = true;
      await this.tournamentService.removePlayer(this.tournament.id, player.id);

      // Manually remove from local array to ensure immediate UI update
      if (this.tournament && this.tournament.players) {
        this.tournament.players = this.tournament.players.filter((p: any) => p.id !== player.id);
      }

      alert('Player removed successfully');

      // Recalculate everything locally for instant UI response
      this.processTeams();
      this.calculateLocalStats();
      this.processBudgetTab();

      // Then sync with server
      await this.loadTournament(this.tournament.id.toString(), true);
    } catch (err: any) {
      console.error('Error removing player:', err);
      alert(err.error?.message || 'Failed to remove player');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  get playerImageUrl(): any {
    return this.imageService.getPlayerImageUrl(this.newPlayer.image);
  }

  getGlobalPlayerImageUrl(image: string): any {
    return this.imageService.getPlayerImageUrl(image);
  }

  onPlayerPhotoSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.isCropperLoading = true;
      this.imageChangedEvent = event;
      this.showCropper = true;
      this.croppedImage = '';

      // Safety timeout: if cropper doesn't respond in 8 seconds, clear loading
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
      // Fallback if base64 is missing but objectUrl is present
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
    console.log('--- CROPPING DEBUG START ---');
    console.log('1. Current croppedImage length:', this.croppedImage?.length || 0);

    // If we have data, use it
    if (this.croppedImage) {
      console.log('2. Image data found, assigning...');
      this.newPlayer.image = this.croppedImage;
      console.log('Image starts with:', this.newPlayer.image.substring(0, 30));
      this.showCropper = false;
      this.imageChangedEvent = '';
      if (this.photoInput) {
        this.photoInput.nativeElement.value = '';
      }
      this.cdr.detectChanges();
      console.log('3. Success');
    } else {
      console.log('2. No data, trying manual component crop...');
      // Final attempt: trigger manual crop if possible
      try {
        const manual = this.cropper.crop();
        if (manual && manual.base64) {
          this.newPlayer.image = manual.base64;
          this.showCropper = false;
          this.imageChangedEvent = '';
          if (this.photoInput) this.photoInput.nativeElement.value = '';
          this.cdr.detectChanges();
          console.log('3. Manual success');
          return;
        }
      } catch (e) {
        console.error('Manual crop failed', e);
      }

      alert('The cropped image is not ready yet. Please try moving the crop box slightly or wait a second.');
    }
    console.log('--- CROPPING DEBUG END ---');
  }

  toggleAddTeamForm() {
    this.showAddTeamForm = !this.showAddTeamForm;
    if (this.showAddTeamForm) {
      this.showAddPlayerForm = false; // Close player form if team form opens
      this.currentTab = 'Teams';
      this.searchTerm = '';
      this.newTeam = {
        name: '',
        code: '',
        ownerName: '',
        email: '',
        logoUrl: ''
      };
    }
    this.cdr.detectChanges();
  }

  toggleAddPlayerForm() {
    this.showAddPlayerForm = !this.showAddPlayerForm;
    if (this.showAddPlayerForm) {
      this.showAddTeamForm = false; // Close team form if player form opens
      this.currentTab = 'Players';
      this.playerSearchTerm = '';
      this.newPlayer = {
        name: '',
        role: 'Batsman',
        mobileNo: '',
        dob: '',
        gender: 'Male',
        tShirtSize: '',
        trouserSize: '',
        image: ''
      };
      this.editingPlayerId = null;
    }
    this.cdr.detectChanges();
  }

  onEditPlayer(player: any) {
    this.editingPlayerId = player.id;
    this.newPlayer = {
      name: player.name,
      role: player.role,
      mobileNo: player.mobileNo || '',
      dob: player.dob || '',
      gender: player.gender || 'Male',
      tShirtSize: player.tShirtSize || '',
      trouserSize: player.trouserSize || '',
      image: player.image || '',
      basePrice: player.basePrice || this.tournament?.minimumPlayerBasePrice || 0
    };
    this.showAddPlayerForm = true;
    this.showAddTeamForm = false;
    this.currentTab = 'Players';
    this.cdr.detectChanges();
  }

  // --- Custom Calendar Logic ---
  toggleCalendar(field: string | null = null) {
    if (field && this.activeDateField === field) {
      this.isCalendarOpen = false;
      this.activeDateField = null;
      return;
    }

    this.isCalendarOpen = true;
    this.activeDateField = field;

    let dateToUse = new Date();
    if (field === 'dob' && this.newPlayer.dob && !isNaN(new Date(this.newPlayer.dob).getTime())) {
      dateToUse = new Date(this.newPlayer.dob);
    } else if (field && this.tournament?.[field] && !isNaN(new Date(this.tournament[field]).getTime())) {
      dateToUse = new Date(this.tournament[field]);
    }

    this.calendarDate = dateToUse;
    this.generateCalendar();
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
    this.cdr.detectChanges();
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
    const dateStr = `${year}-${month}-${d}`;

    if (this.activeDateField === 'dob') {
      this.newPlayer.dob = dateStr;
    } else if (this.activeDateField && this.tournament) {
      this.tournament[this.activeDateField] = dateStr;
      this.validateTournamentDates(false);
    }

    this.isCalendarOpen = false;
    this.activeDateField = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Don't close if clicking inside a dropdown or a calendar-related element
    if (!target.closest('.custom-dropdown') && !target.closest('.date-input-wrapper') && !target.closest('.custom-calendar-popup')) {
      this.isCalendarOpen = false;
      this.activeDateField = null;
      this.isRoleDropdownOpen = false;
      this.isTshirtDropdownOpen = false;
      this.isGenderDropdownOpen = false;
      this.isCategoryDropdownOpen = false;
      this.isFormatDropdownOpen = false;
      this.cdr.detectChanges();
    }
  }

  toggleRoleDropdown() { this.isRoleDropdownOpen = !this.isRoleDropdownOpen; }
  selectRole(role: string) {
    this.newPlayer.role = role;
    this.isRoleDropdownOpen = false;
  }

  toggleTshirtDropdown() { this.isTshirtDropdownOpen = !this.isTshirtDropdownOpen; }
  selectTshirt(size: string) {
    this.newPlayer.tShirtSize = size;
    this.isTshirtDropdownOpen = false;
  }

  toggleGenderDropdown() { this.isGenderDropdownOpen = !this.isGenderDropdownOpen; }
  selectGender(gender: string) {
    this.newPlayer.gender = gender;
    this.isGenderDropdownOpen = false;
  }

  toggleCategoryDropdown() { this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen; }
  selectCategory(cat: string) {
    this.tournament.category = cat;
    this.isCategoryDropdownOpen = false;
  }

  toggleFormatDropdown() { this.isFormatDropdownOpen = !this.isFormatDropdownOpen; }
  selectFormat(fmt: string) {
    this.tournament.format = fmt;
    this.isFormatDropdownOpen = false;
  }

  numberOnly(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  async onMobileChange() {
    if (this.newPlayer.mobileNo && this.newPlayer.mobileNo.length === 10) {
      try {
        const existing = await this.tournamentService.checkPlayerByMobile(this.newPlayer.mobileNo);
        if (existing) {
          // Merge existing data into the current newPlayer object
          this.newPlayer = {
            ...this.newPlayer,
            ...existing,
            // Format DOB for the form
            dob: existing.dob ? existing.dob.split('T')[0] : ''
          };

          // We don't have a 'message' property here like in registration, 
          // but we can at least detect changes. 
          // If you want a message, you could add one, but autofill is the main goal.
          this.cdr.detectChanges();
        }
      } catch (err) {
        // 404 is expected for new players
        console.log('New player or error checking mobile:', err);
      }
    }
  }

  private blobUrlToBase64(blobUrl: string): Promise<string> {
    return this.imageService.blobUrlToBase64(blobUrl);
  }

  async submitAddTeam() {
    if (!this.newTeam.name || !this.newTeam.code || !this.newTeam.email || this.saving) return;

    this.saving = true;
    try {
      const response = await this.tournamentService.addTeam(this.tournament.id, this.newTeam);
      this.showAddTeamForm = false;
      this.currentTab = 'Teams'; // Stay on teams tab
      await this.loadTournament(this.tournament.id.toString(), true); // Silent reload

      if (response && response.defaultPassword) {
        this.createdCredentials = {
          username: response.code.toLowerCase(),
          password: response.defaultPassword,
          email: this.newTeam.email,
          role: 'Team Owner'
        };
        this.showCredentialsModal = true;
      }

      this.newTeam = {
        name: '',
        code: '',
        ownerName: '',
        email: '',
        logoUrl: ''
      };
    } catch (err: any) {
      console.error('Error adding team:', err);
      const errorMsg = err.error?.error || err.error?.message || 'Failed to add team. Check if team code is unique.';
      alert(errorMsg);
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  copyCredentials() {
    const text = `BidWicket Login Credentials\n---------------------------\nRole: ${this.createdCredentials.role}\nUsername: ${this.createdCredentials.username}\nPassword: ${this.createdCredentials.password}\n---------------------------\nChange your password on first login.`;
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
      this.cdr.detectChanges();
    }).catch(err => {
      console.error('Could not copy credentials:', err);
    });
  }

  closeCredentialsModal() {
    this.showCredentialsModal = false;
    this.cdr.detectChanges();
  }

  openRegistrationLinkModal() {
    const origin = window.location.origin || '';
    const tournamentIdPart = this.tournament && this.tournament.id ? `?tournamentId=${this.tournament.id}` : '';
    this.registrationUrl = `${origin}/register${tournamentIdPart}`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(this.registrationUrl)}`;
    this.showRegistrationModal = true;
    this.copiedRegistration = false;
    this.cdr.detectChanges();
  }

  copyRegistrationLink() {
    if (!this.registrationUrl) return;
    navigator.clipboard.writeText(this.registrationUrl).then(() => {
      this.copiedRegistration = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiedRegistration = false;
        this.cdr.detectChanges();
      }, 2000);
    }).catch(err => {
      console.error('Could not copy registration link:', err);
      alert('Could not copy link to clipboard');
    });
  }

  closeRegistrationModal() {
    this.showRegistrationModal = false;
    this.cdr.detectChanges();
  }

  async submitAddPlayer() {
    if (!this.newPlayer.name || !this.newPlayer.role || !this.newPlayer.dob || this.saving) return;

    this.saving = true;
    try {
      // Ensure we don't send blob URLs to backend
      if (this.newPlayer.image && this.newPlayer.image.startsWith('blob:')) {
        console.log('Converting blob URL to base64 before upload...');
        try {
          this.newPlayer.image = await this.blobUrlToBase64(this.newPlayer.image);
          console.log('Conversion successful. Length:', this.newPlayer.image.length);
        } catch (blobErr) {
          console.error('Failed to convert blob to base64:', blobErr);
        }
      }

      // Ensure basePrice is set from tournament
      this.newPlayer.basePrice = this.tournament?.minimumPlayerBasePrice || 0;

      if (this.editingPlayerId) {
        await this.tournamentService.updatePlayer(this.tournament.id, this.editingPlayerId, this.newPlayer);
      } else {
        await this.tournamentService.addPlayer(this.tournament.id, this.newPlayer);
      }
      this.showAddPlayerForm = false;
      this.editingPlayerId = null;
      this.currentTab = 'Players';
      await this.loadTournament(this.tournament.id.toString(), true); // Silent reload
    } catch (err: any) {
      console.error('Error saving player:', err);
      const errorMsg = err.error?.error || err.error?.message || 'Failed to save player. Please try again.';
      alert(errorMsg);
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  stats = {
    playersSold: 0,
    totalSpent: 0,
    registeredTeams: 0,
    avgSoldPrice: 0,
    highestBid: 0,
    highestBidder: 'N/A',
    battingCount: 0,
    bowlingCount: 0,
    arCount: 0,
    wkCount: 0,
    unsoldPlayers: 0,
    remainingPlayers: 0,
    auctionRounds: 2,
    totalRounds: 5
  };

  budgetStats = {
    totalPool: 0,
    totalSpent: 0,
    remainingPool: 0,
    spentPercentage: 0
  };

  teamBudgets: any[] = [];

  recentActivity: any[] = [];
  timeline: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private imageService: ImageService
  ) {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 60; i <= currentYear + 5; i++) {
      this.years.push(i);
    }
    this.years.reverse();
  }

  ngOnInit() {
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

    this.adminName = user?.username || 'Admin';

    if (this.authService.isTournamentAdmin()) {
      if (String(user.tournamentId) !== String(tournamentId)) {
        this.router.navigate(['/tournament-detail', user.tournamentId]);
        return;
      }
    }

    if (tournamentId) {
      this.loadTournament(tournamentId);
    }
  }

  async loadTournament(id: string, silent: boolean = false) {
    if (!silent) this.loading = true;
    try {
      const [detail, all] = await Promise.all([
        this.tournamentService.getById(id),
        this.tournamentService.getAll()
      ]);
      this.tournament = detail;
      this.computeAndSetStatus();
      this.buildTimeline();
      this.tournaments = all || [];
      this.processTeams();
      this.calculateLocalStats();
      this.processBudgetTab();
    } catch (err: any) {
      console.error('Error loading tournament:', err);
    } finally {
      if (!silent) this.loading = false;
      this.cdr.detectChanges();
    }
  }

  processBudgetTab() {
    if (!this.tournament || !this.tournament.teams) return;

    const teams = this.tournament.teams;
    const players = this.tournament.players || [];

    let totalPool = 0;
    let totalSpent = 0;

    this.teamBudgets = teams.map((team: any) => {
      const bBought = players.filter((p: any) => p.soldTo === team.id && p.status === 'SOLD');
      const spent = bBought.reduce((sum: number, p: any) => sum + (p.soldPrice || 0), 0);
      const balance = team.budget - spent;
      const usedPercentage = (spent / team.budget) * 100;

      totalPool += team.budget;
      totalSpent += spent;

      return {
        ...team,
        ownerName: team.ownerName || 'Admin',
        amountSpent: spent,
        balanceLeft: balance,
        playersBoughtCount: bBought.length,
        usedPercentage: usedPercentage,
        boughtPlayers: bBought.slice(0, 3).map((p: any) => ({
          name: p.name,
          role: p.role,
          price: p.soldPrice,
          initials: p.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
        }))
      };
    });

    this.budgetStats = {
      totalPool: totalPool,
      totalSpent: totalSpent,
      remainingPool: totalPool - totalSpent,
      spentPercentage: (totalSpent / totalPool) * 100
    };
  }

  processTeams() {
    if (!this.tournament || !this.tournament.teams) return;

    this.processedTeams = this.tournament.teams.map((team: any) => {
      const teamPlayers = this.tournament.players?.filter((p: any) => p.soldTo === team.id && p.status === 'SOLD') || [];
      return {
        ...team,
        tournamentName: this.tournament.name,
        tournamentId: this.tournament.id,
        ownerName: team.ownerName || 'Admin',
        playersCount: teamPlayers.length,
        batsmenCount: teamPlayers.filter((p: any) => p.role === 'Batsman').length,
        bowlersCount: teamPlayers.filter((p: any) => p.role === 'Bowler').length,
        arCount: teamPlayers.filter((p: any) => p.role === 'All-Rounder').length,
        wkCount: teamPlayers.filter((p: any) => p.role === 'Wicketkeeper').length,
        isActive: this.tournament.status === 'ACTIVE',
        isLowBudget: team.remainingBudget < (team.budget * 0.2)
      };
    });
  }

  get filteredTeams() {
    if (!this.processedTeams) return [];
    const term = (this.searchTerm || '').toLowerCase().trim();
    if (!term) return this.processedTeams;

    return this.processedTeams.filter(team =>
      String(team?.name || '').toLowerCase().includes(term) ||
      String(team?.code || '').toLowerCase().includes(term) ||
      String(team?.ownerName || '').toLowerCase().includes(term)
    );
  }

  get filteredPlayers() {
    if (!this.tournament?.players) return [];
    const term = (this.playerSearchTerm || '').toLowerCase().trim();
    if (!term) return this.tournament.players;

    return this.tournament.players.filter((player: any) =>
      String(player.name || '').toLowerCase().includes(term) ||
      String(player.role || '').toLowerCase().includes(term) ||
      String(player.city || '').toLowerCase().includes(term) ||
      String(player.mobileNo || '').toLowerCase().includes(term)
    );
  }

  onSearch() {
    // This exists to provide a target for (input) events and force change detection if needed
    this.cdr.detectChanges();
  }

  calculateLocalStats() {
    if (!this.tournament) return;

    const players = this.tournament.players || [];
    const teams = this.tournament.teams || [];

    let totalSpent = 0;
    let soldCount = 0;
    let highestBid = 0;
    let highestBidder = 'N/A';

    let bat = 0, bwl = 0, ar = 0, wk = 0;
    let unsold = 0;
    let upcoming = 0;

    players.forEach((p: any) => {
      if (p.status === 'SOLD') {
        soldCount++;
        totalSpent += p.soldPrice;
        if (p.soldPrice > highestBid) {
          highestBid = p.soldPrice;
          highestBidder = p.name;
        }

        if (p.role === 'Batsman') bat++;
        else if (p.role === 'Bowler') bwl++;
        else if (p.role === 'All-Rounder') ar++;
        else if (p.role === 'Wicketkeeper') wk++;
      } else if (p.status === 'UNSOLD') {
        unsold++;
      } else {
        upcoming++;
      }
    });

    this.stats = {
      ...this.stats,
      playersSold: soldCount,
      totalSpent: totalSpent,
      registeredTeams: teams.length,
      avgSoldPrice: soldCount > 0 ? totalSpent / soldCount : 0,
      highestBid: highestBid,
      highestBidder: highestBidder,
      battingCount: bat,
      bowlingCount: bwl,
      arCount: ar,
      wkCount: wk,
      unsoldPlayers: unsold,
      remainingPlayers: upcoming
    };

    this.recentActivity = players
      .filter((p: any) => p.status === 'SOLD')
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 50)
      .map((p: any) => ({
        name: p.name,
        team: teams.find((t: any) => t.id === p.soldTo)?.name || 'Unknown',
        price: p.soldPrice,
        code: p.name[0]
      }));
  }

  setTab(tab: string) {
    this.currentTab = tab;
    this.cdr.detectChanges();
  }

  formatCurrency(value: number): string {
    if (!value) return '0';
    if (value >= 10000000) {
      const cr = value / 10000000;
      return cr % 1 === 0 ? cr.toFixed(0) + 'Cr' : cr.toFixed(2) + 'Cr';
    } else if (value >= 100000) {
      const l = value / 100000;
      return l % 1 === 0 ? l.toFixed(0) + 'L' : l.toFixed(1) + 'L';
    } else if (value >= 1000) {
      const k = value / 1000;
      return k % 1 === 0 ? k.toFixed(0) + 'K' : k.toFixed(1) + 'K';
    } else {
      return value.toLocaleString('en-IN');
    }
  }

  formatInL(value: number): { val: string, unit: string } {
    if (!value) return { val: '0', unit: 'L' };
    const l = value / 100000;
    return {
      val: l % 1 === 0 ? l.toFixed(0) : l.toFixed(1),
      unit: 'L'
    };
  }

  getBestUnit(value: number): string {
    if (value >= 9000000) return 'Cr'; // 90 Lakhs+ -> Cr
    if (value >= 100000) return 'L';  // 1 Lakh+ -> L
    if (value >= 1000) return 'K';    // 1k+ -> K
    return '';
  }

  formatInUnit(value: number, unit: string): { val: string, unit: string } {
    if (!value && value !== 0) return { val: '0', unit };

    let valStr = '0';
    if (unit === 'Cr') {
      const cr = value / 10000000;
      valStr = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2);
    } else if (unit === 'L') {
      const l = value / 100000;
      valStr = l % 1 === 0 ? l.toFixed(0) : l.toFixed(1);
    } else if (unit === 'K') {
      const k = value / 1000;
      valStr = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    } else {
      valStr = value.toLocaleString('en-IN');
    }
    return { val: valStr, unit };
  }

  formatAuto(value: number): { val: string, unit: string } {
    const unit = this.getBestUnit(value);
    return this.formatInUnit(value, unit);
  }

  validateTournamentDates(onSave: boolean = false): boolean {
    if (!this.tournament) return false;

    this.dateErrors = {}; // Clear previous errors
    this.settingsError = '';

    const tsStr = this.tournament.tournamentStartDate;
    const teStr = this.tournament.tournamentEndDate;
    const rsStr = this.tournament.regStartDate;
    const reStr = this.tournament.regEndDate;
    const adStr = this.tournament.auctionDate;
    const msStr = this.tournament.matchStartDate;
    const meStr = this.tournament.matchEndDate;

    let hasErrors = false;

    if (onSave) {
      if (!tsStr) { this.dateErrors['tournamentStartDate'] = 'Tournament Start Date is required.'; hasErrors = true; }
      if (!teStr) { this.dateErrors['tournamentEndDate'] = 'Tournament End Date is required.'; hasErrors = true; }
      if (!rsStr) { this.dateErrors['regStartDate'] = 'Registration Start Date is required.'; hasErrors = true; }
      if (!reStr) { this.dateErrors['regEndDate'] = 'Registration End Date is required.'; hasErrors = true; }
      if (!adStr) { this.dateErrors['auctionDate'] = 'Auction Date is required.'; hasErrors = true; }
      if (!msStr) { this.dateErrors['matchStartDate'] = 'Match Start Date is required.'; hasErrors = true; }
      if (!meStr) { this.dateErrors['matchEndDate'] = 'Match End Date is required.'; hasErrors = true; }
    }

    try {
      const ts = tsStr ? this.parseLocalDate(tsStr) : null;
      const te = teStr ? this.parseLocalDate(teStr) : null;
      const rs = rsStr ? this.parseLocalDate(rsStr) : null;
      const re = reStr ? this.parseLocalDate(reStr) : null;
      const ad = adStr ? this.parseLocalDate(adStr) : null;
      const ms = msStr ? this.parseLocalDate(msStr) : null;
      const me = meStr ? this.parseLocalDate(meStr) : null;

      if (ts && te && ts > te) {
        this.dateErrors['tournamentEndDate'] = 'Tournament End Date must be after or equal to Tournament Start Date.';
        hasErrors = true;
      }

      if (rs && ts && rs.getTime() !== ts.getTime()) {
        this.dateErrors['regStartDate'] = 'Registration Start Date must be equal to the Tournament Start Date.';
        hasErrors = true;
      }

      if (re) {
        if (ts && re < ts) {
          this.dateErrors['regEndDate'] = 'Registration End Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (te && re > te) {
          this.dateErrors['regEndDate'] = 'Registration End Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        }
      }

      if (ad) {
        if (ts && ad < ts) {
          this.dateErrors['auctionDate'] = 'Auction Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (te && ad > te) {
          this.dateErrors['auctionDate'] = 'Auction Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (re && ad <= re) {
          this.dateErrors['auctionDate'] = 'Auction Date must be after the Registration End Date.';
          hasErrors = true;
        }
      }

      if (ms) {
        if (ts && ms < ts) {
          this.dateErrors['matchStartDate'] = 'Match Start Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (te && ms > te) {
          this.dateErrors['matchStartDate'] = 'Match Start Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (ad && ms <= ad) {
          this.dateErrors['matchStartDate'] = 'Match Start Date must be after the Auction Date.';
          hasErrors = true;
        }
      }

      if (me) {
        if (ts && me < ts) {
          this.dateErrors['matchEndDate'] = 'Match End Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        } else if (te && me > te) {
          this.dateErrors['matchEndDate'] = 'Match End Date must be between the Tournament Start and End Dates.';
          hasErrors = true;
        }
      }

      if (ms && me && ms > me) {
        this.dateErrors['matchEndDate'] = 'Match End Date must be after or equal to the Match Start Date.';
        hasErrors = true;
      }

      return !hasErrors;
    } catch (e) {
      console.error('Error validating dates:', e);
      this.settingsError = 'Invalid date format.';
      return false;
    }
  }

  async updateTournamentDetails() {
    if (!this.tournament || this.saving) return;
    if (!this.validateTournamentDates(true)) return;
    this.saving = true;
    try {
      this.computeAndSetStatus();

      // If budget is not defined or is 0/empty, set it to the default projected formula
      if (!this.tournament.totalAmount) {
        this.tournament.totalAmount = this.getProjectedBudget();
      }

      // Reset edit permission flag to 0 on saving details
      if (this.tournament.isrequestedtoedit === 2) {
        this.tournament.isrequestedtoedit = 0;
      }

      await this.tournamentService.update(this.tournament.id, this.tournament);
      alert('Tournament updated successfully!');
      this.setTab('Overview');
      await this.loadTournament(this.tournament.id.toString());
    } catch (err: any) {
      console.error('Error updating tournament:', err);
      alert('Failed to update tournament');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isTournamentAdmin(): boolean {
    return this.authService.isTournamentAdmin();
  }

  isFieldsDisabled(): boolean {
    if (!this.tournament) return true;
    if (this.isTournamentAdmin()) {
      return this.tournament.isrequestedtoedit !== 2;
    }
    return false;
  }

  async requestEditPermission() {
    if (!this.tournament || this.saving) return;
    this.saving = true;
    try {
      await this.tournamentService.update(this.tournament.id, { isrequestedtoedit: 1 });
      alert('Edit permission requested successfully! Waiting for main admin approval.');
      await this.loadTournament(this.tournament.id.toString(), true);
    } catch (err: any) {
      console.error('Error requesting edit permission:', err);
      alert('Failed to request edit permission');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async respondToEditRequest(status: number) {
    if (!this.tournament || this.saving) return;
    this.saving = true;
    try {
      await this.tournamentService.update(this.tournament.id, { isrequestedtoedit: status });
      if (status === 2) {
        alert('Edit request approved! The tournament admin can now modify details.');
      } else {
        alert('Edit request declined.');
      }
      await this.loadTournament(this.tournament.id.toString(), true);
    } catch (err: any) {
      console.error('Error responding to edit request:', err);
      alert('Failed to respond to edit request');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  computeAndSetStatus() {
    if (!this.tournament) return;
    const now = new Date();
    const start = this.tournament.tournamentStartDate ? new Date(this.tournament.tournamentStartDate) : null;
    const end = this.tournament.tournamentEndDate ? new Date(this.tournament.tournamentEndDate) : null;
    let status = this.tournament.status || 'UPCOMING';

    if (start && end) {
      if (now < start) status = 'UPCOMING';
      else if (now >= start && now <= end) status = 'ACTIVE';
      else status = 'COMPLETED';
    } else if (start && !end) {
      status = now < start ? 'UPCOMING' : 'ACTIVE';
    } else if (!start && end) {
      status = now <= end ? 'ACTIVE' : 'COMPLETED';
    }

    this.tournament.status = status;
  }

  getProjectedBudget(): number {
    if (!this.tournament) return 0;
    const p = Number(this.tournament.playersPerTeam || 0);
    const m = Number(this.tournament.minimumPlayerBasePrice || 0);
    const c = Number(this.tournament.competitionFactor || 5);
    const budget = Math.round(p * m * c);
    return isNaN(budget) ? 0 : budget;
  }

  onBudgetParamChange() {
    this.tournament.totalAmount = this.getProjectedBudget();
    this.cdr.detectChanges();
  }

  formatIndianNumber(value: number | string): string {
    if (value === undefined || value === null || value === '') return '';
    const num = Number(value);
    return isNaN(num) ? '' : num.toLocaleString('en-IN');
  }

  private formatDateLabel(date: Date | null) {
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private statusForRange(start: Date | null, end: Date | null) {
    const now = new Date();
    if (start && end) {
      if (now < start) return 'UPCOMING';
      if (now >= start && now <= end) return 'IN PROGRESS';
      return 'COMPLETED';
    }
    if (start && !end) return now < start ? 'UPCOMING' : 'IN PROGRESS';
    if (!start && end) return now <= end ? 'IN PROGRESS' : 'COMPLETED';
    return 'UPCOMING';
  }

  private statusForDate(d: Date | null) {
    if (!d) return 'UPCOMING';
    const now = new Date();
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    if (now < startOfDay) return 'UPCOMING';
    if (now >= startOfDay && now <= endOfDay) return 'IN PROGRESS';
    return 'COMPLETED';
  }

  buildTimeline() {
    if (!this.tournament) {
      this.timeline = [];
      return;
    }

    const tStart = this.tournament.tournamentStartDate ? new Date(this.tournament.tournamentStartDate) : null;
    const tEnd = this.tournament.tournamentEndDate ? new Date(this.tournament.tournamentEndDate) : null;
    const regStart = this.tournament.regStartDate ? new Date(this.tournament.regStartDate) : null;
    const regEnd = this.tournament.regEndDate ? new Date(this.tournament.regEndDate) : null;
    const auction = this.tournament.auctionDate ? new Date(this.tournament.auctionDate) : null;
    const mStart = this.tournament.matchStartDate ? new Date(this.tournament.matchStartDate) : null;
    const mEnd = this.tournament.matchEndDate ? new Date(this.tournament.matchEndDate) : null;

    const timeline: any[] = [];

    // 1. Tournament Start
    timeline.push({
      label: 'Tournament Start',
      date: this.formatDateLabel(tStart),
      status: this.statusForDate(tStart),
      type: 'tournament',
      position: 'top'
    });

    // 2. Registration (Range)
    const regStatus = this.statusForRange(regStart, regEnd);
    timeline.push({
      label: 'Registration',
      date: regStart && regEnd ? `${this.formatDateShort(regStart)} → ${this.formatDateShort(regEnd)}` : this.formatDateLabel(regStart),
      status: regStatus,
      type: 'registration',
      position: 'bottom'
    });

    // 3. Auction
    timeline.push({
      label: 'Auction',
      date: this.formatDateLabel(auction),
      status: this.statusForDate(auction),
      type: 'auction',
      position: 'top'
    });

    // 4. Match (Range)
    const matchStatus = this.statusForRange(mStart, mEnd);
    timeline.push({
      label: 'Match',
      date: mStart && mEnd ? `${this.formatDateShort(mStart)} → ${this.formatDateShort(mEnd)}` : this.formatDateLabel(mStart),
      status: matchStatus,
      type: 'match',
      position: 'bottom'
    });

    // 5. Tournament End
    timeline.push({
      label: 'Tournament End',
      date: this.formatDateLabel(tEnd),
      status: this.statusForDate(tEnd),
      type: 'tournament-end',
      position: 'top'
    });

    this.timeline = timeline;
  }

  private formatDateShort(date: Date | null) {
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  private parseLocalDate(dateStr: string): Date {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  shouldShowAuctionButton(): boolean {
    if (!this.tournament) return false;
    if (this.tournament.status !== 'ACTIVE') return false;

    // If either auctionDate or matchStartDate is not set, default to showing the button when ACTIVE
    if (!this.tournament.auctionDate || !this.tournament.matchStartDate) {
      return true;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const auctionDate = this.parseLocalDate(this.tournament.auctionDate);
      const matchStartDate = this.parseLocalDate(this.tournament.matchStartDate);

      // Calculate matchStartDate - 1 day
      const matchStartMinusOneDay = new Date(matchStartDate);
      matchStartMinusOneDay.setDate(matchStartMinusOneDay.getDate() - 1);
      matchStartMinusOneDay.setHours(0, 0, 0, 0);

      return today >= auctionDate && today <= matchStartMinusOneDay;
    } catch (e) {
      console.error('Error parsing tournament dates:', e);
      return true; // Fallback to true if parsing fails
    }
  }

  startAuction() {
    this.router.navigate(['/auction', this.tournament.id]);
  }

  startUnsoldAuction() {
    this.router.navigate(['/auction', this.tournament.id], { queryParams: { mode: 'unsold' } });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
