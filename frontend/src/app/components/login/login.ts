import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  credentials = {
    username: '',
    password: ''
  };
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  async onSubmit() {
    if (!this.credentials.username || !this.credentials.password) {
      this.error = 'Please enter both username and password';
      return;
    }

    this.error = '';
    this.loading = true;

    try {
      const data = await this.authService.login(this.credentials);

      if (data.token) {
        // Redirect based on role
        if (data.user.role === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else if (data.user.role === 'TOURNAMENT_ADMIN') {
          if (data.user.tournamentId) {
            this.router.navigate(['/tournament-detail', data.user.tournamentId]);
          } else {
            this.error = 'No tournament assigned to this admin.';
          }
        } else {
          // For team users, redirect to team dashboard
          this.router.navigate(['/team-dashboard']);
        }
      } else {
        this.error = data.message || 'Login failed';
      }
    } catch (err: any) {
      this.error = 'Unable to connect to server';
      console.error(err);
    } finally {
      this.loading = false;
    }
  }
}
