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

  constructor(
    private tournamentService: TournamentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { 
    const currentYear = new Date().getFullYear();
    for(let i = currentYear - 60; i <= currentYear + 5; i++) {
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
    }

    this.isCalendarOpen = false;
    this.activeDateField = null;
    this.cdr.detectChanges();
  }

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

    // Set totalAmount explicitly based on formula
    this.tournamentData.totalAmount = this.getProjectedBudget();

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
