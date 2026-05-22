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

  // Force Password Reset Flow
  mustChange = false;
  newPassword = '';
  confirmPassword = '';
  tempSessionData: any = null;

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

      if (data.mustChangePassword) {
        this.mustChange = true;
        this.tempSessionData = data;
        // Temporarily store token/user to allow authorized requests
        this.authService.saveSession(data.token, data.user);
        this.loading = false;
        return;
      }

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
      this.error = err.error?.message || 'Unable to connect to server';
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  async onSubmitNewPassword() {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = 'Password must be at least 6 characters long';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.authService.changePassword(this.newPassword);
      
      const user = this.tempSessionData.user;
      
      // Update local storage representation so mustChangePassword matches false
      user.mustChangePassword = false;
      this.authService.saveSession(this.tempSessionData.token, user);

      alert('Password updated successfully! Redirecting...');
      
      if (user.role === 'ADMIN') {
        this.router.navigate(['/admin']);
      } else if (user.role === 'TOURNAMENT_ADMIN') {
        if (user.tournamentId) {
          this.router.navigate(['/tournament-detail', user.tournamentId]);
        } else {
          this.error = 'No tournament assigned to this admin.';
        }
      } else {
        this.router.navigate(['/team-dashboard']);
      }
    } catch (err: any) {
      this.error = err.error?.message || 'Failed to update password';
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  cancelPasswordReset() {
    this.mustChange = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.tempSessionData = null;
    this.authService.logout();
  }
}
