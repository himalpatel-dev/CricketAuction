import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-top-nav',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './top-nav.html',
    styleUrls: ['./top-nav.css']
})
export class TopNavComponent implements OnInit {
    adminName: string = 'User';
    isAdmin: boolean = false;
    userInitials: string = 'U';
    isMenuOpen: boolean = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        public theme: ThemeService
    ) { }

    ngOnInit() {
        const user = this.authService.getUser();
        if (user) {
            this.adminName = user.username || 'User';
            this.isAdmin = user.role === 'ADMIN';
            this.userInitials = this.adminName.substring(0, 2).toUpperCase();
        }
    }

    toggleUserMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        // Simple toggle for now, could show a dropdown menu
        if (confirm('Logout?')) {
            this.logout();
        }
    }

    initialsOf(name: string) {
        return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    }

    logout() {
        // Tournament users go back to their tournament's own branded login page
        const brand = this.theme.branding();
        this.authService.logout();
        this.router.navigate(brand ? ['/login', brand.id] : ['/login']);
    }
}
