import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
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
  tournamentData: any = {
    name: '',
    email: '',
    tournamentStartDate: '',
    tournamentEndDate: '',
    matchStartDate: '',
    matchEndDate: '',
    regStartDate: '',
    regEndDate: '',
    auctionDate: '',
    totalPlayers: 100,
    playersPerTeam: 10,
    minimumPlayerBasePrice: 50000,
    competitionFactor: 5,
    totalAmount: 10 * 50000 * 5,
    format: 'T20',
    category: 'Franchise League',
    status: 'UPCOMING'
  };

  // Credentials Modal State
  showCredentialsModal = false;
  createdCredentials = {
    username: '',
    password: '',
    role: 'Tournament Admin'
  };
  copied = false;

  // Calendar State
  isCalendarOpen = false;
  activeDateField: string | null = null;
  calendarDate: Date = new Date();
  calendarDays: any[] = [];
  calendarMonthYear: string = '';
  weekDays: string[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  years: number[] = [];
  selectedMonth: number = new Date().getMonth();
  selectedYear: number = new Date().getFullYear();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.date-input-wrapper') && !target.closest('.custom-calendar-popup')) {
      this.isCalendarOpen = false;
      this.activeDateField = null;
      this.cdr.detectChanges();
    }
  }

  loading = false;
  error = '';
  dateErrors: { [key: string]: string } = {};

  constructor(
    private tournamentService: TournamentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 60; i <= currentYear + 5; i++) {
      this.years.push(i);
    }
    this.years.reverse();
  }

  // --- Custom Calendar Logic ---
  toggleCalendar(field: string) {
    if (this.activeDateField === field) {
      this.isCalendarOpen = false;
      this.activeDateField = null;
      return;
    }

    this.isCalendarOpen = true;
    this.activeDateField = field;

    let dateToUse = new Date();
    const existingDate = this.tournamentData[field];
    if (existingDate && !isNaN(new Date(existingDate).getTime())) {
      dateToUse = new Date(existingDate);
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

    if (this.activeDateField) {
      this.tournamentData[this.activeDateField] = dateStr;
      this.validateTournamentDates(false);
    }

    this.isCalendarOpen = false;
    this.activeDateField = null;
    this.cdr.detectChanges();
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

  validateTournamentDates(onSave: boolean = false): boolean {
    if (!this.tournamentData) return false;

    this.dateErrors = {}; // Clear previous errors
    this.error = '';

    const tsStr = this.tournamentData.tournamentStartDate;
    const teStr = this.tournamentData.tournamentEndDate;
    const rsStr = this.tournamentData.regStartDate;
    const reStr = this.tournamentData.regEndDate;
    const adStr = this.tournamentData.auctionDate;
    const msStr = this.tournamentData.matchStartDate;
    const meStr = this.tournamentData.matchEndDate;

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
      this.error = 'Invalid date format.';
      return false;
    }
  }

  async onSubmit() {
    this.error = '';
    if (!this.tournamentData.email) {
      this.error = 'Admin Email is required.';
      return;
    }
    if (!this.validateTournamentDates(true)) {
      return;
    }

    this.loading = true;

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

    // Ensure totalAmount is set, default to projected formula if missing
    if (this.tournamentData.totalAmount === undefined || this.tournamentData.totalAmount === null || this.tournamentData.totalAmount === '') {
      this.tournamentData.totalAmount = this.getProjectedBudget();
    }

    try {
      const response: any = await this.tournamentService.create(this.tournamentData);
      
      if (response && response.defaultAdminCredentials) {
        this.createdCredentials = {
          username: response.defaultAdminCredentials.username,
          password: response.defaultAdminCredentials.password,
          role: 'Tournament Admin'
        };
        this.showCredentialsModal = true;
      } else {
        this.router.navigate(['/tournaments']);
      }
    } catch (err: any) {
      console.error('Create Tournament Error:', err);
      this.error = err.error?.error || err.error?.message || 'Failed to create tournament. Please try again.';
    } finally {
      this.loading = false;
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
    this.router.navigate(['/tournaments']);
  }

  onParamChange() {
    this.tournamentData.totalAmount = this.getProjectedBudget();
  }

  formatIndianNumber(value: number | string): string {
    if (value === undefined || value === null || value === '') return '';
    const num = Number(value);
    return isNaN(num) ? '' : num.toLocaleString('en-IN');
  }

  getProjectedBudget(): number {
    if (!this.tournamentData) return 0;
    const p = Number(this.tournamentData.playersPerTeam || 0);
    const m = Number(this.tournamentData.minimumPlayerBasePrice || 0);
    const c = Number(this.tournamentData.competitionFactor || 5);
    const budget = Math.round(p * m * c);
    return isNaN(budget) ? 0 : budget;
  }

  cancel() {
    this.router.navigate(['/tournaments']);
  }
}
