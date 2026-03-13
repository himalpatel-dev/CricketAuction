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

    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        const user = this.authService.getCurrentUser();
        if (user) {
            this.adminName = user.name || 'Admin';
        }
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
