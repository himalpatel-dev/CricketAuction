import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-top-nav',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './top-nav.html',
    styleUrls: ['./top-nav.css']
})
export class TopNavComponent implements OnInit {
    adminName: string = 'Admin';
    isAdmin: boolean = false;
    userInitials: string = 'AD';

    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        const user = this.authService.getUser();
        if (user) {
            this.adminName = user.username || 'Admin';
            this.isAdmin = user.role === 'ADMIN';
            this.userInitials = this.adminName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
        }
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
