import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

/** What a tournament can customise about its look. Colors are #rrggbb; null/empty = BidWicket default. */
export interface TournamentBranding {
    id: number;
    name: string;
    logo?: string | null;
    bannerImage?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    location?: string | null;
    category?: string | null;
}

export interface ThemeColors {
    primary: string;   // dark brand color: nav bar, headers, dark panels (white text sits on it)
    secondary: string; // highlight color: buttons, active tabs, links
    accent: string;    // pop color: badges, current bid, logo frame
}

export const DEFAULT_THEME: ThemeColors = {
    primary: '#133b33',
    secondary: '#10b981',
    accent: '#ffb700',
};

/** Ready-made color combinations offered in the branding editor. */
export const THEME_PRESETS: Array<{ name: string } & ThemeColors> = [
    { name: 'BidWicket Classic', ...DEFAULT_THEME },
    { name: 'Royal Blue', primary: '#14213d', secondary: '#3b82f6', accent: '#fca311' },
    { name: 'Purple Gold', primary: '#2e1065', secondary: '#8b5cf6', accent: '#facc15' },
    { name: 'Crimson', primary: '#3b0d11', secondary: '#e11d48', accent: '#fbbf24' },
    { name: 'Ocean', primary: '#0c2d48', secondary: '#0ea5e9', accent: '#f97316' },
    { name: 'Midnight', primary: '#111827', secondary: '#6366f1', accent: '#22d3ee' },
    { name: 'Saffron', primary: '#1f2937', secondary: '#f97316', accent: '#16a34a' },
    { name: 'Forest', primary: '#1a2e05', secondary: '#65a30d', accent: '#eab308' },
];

const CACHE_KEY = 'tournamentBranding';
const TOURNAMENT_IMAGE_PATH = '/uploads/tournament/';

/** Every CSS variable this service may override (reset removes them so styles.css defaults return). */
const THEME_VARS = [
    '--primary', '--primary-rgb', '--primary-dark', '--primary-deep', '--primary-deep-rgb', '--bg-sidebar',
    '--primary-light', '--secondary-rgb', '--secondary-dark', '--secondary-soft', '--secondary-ink',
    '--accent', '--accent-rgb', '--accent-hover', '--on-accent', '--on-secondary',
];

/**
 * Applies a tournament's own logo, banner and colors to the whole app.
 *
 * The theme follows the URL: any page that belongs to one tournament (its dashboard, auction board,
 * live view, team dashboard, branded login /login/:id, player registration for it) shows that
 * tournament's branding; main-admin pages fall back to the default BidWicket look.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    /** Branding currently on screen, or null for the default BidWicket look. */
    readonly branding = signal<TournamentBranding | null>(null);
    readonly logoUrl = computed(() => this.imageUrl(this.branding()?.logo));
    readonly bannerUrl = computed(() => this.imageUrl(this.branding()?.bannerImage));

    private requestedId: number | null = null;
    /** The page's own icons (href + type) so they can be put back after showing a tournament logo. */
    private defaultFavicons = new Map<HTMLLinkElement, { href: string; type: string | null }>();

    constructor(private http: HttpClient, private router: Router) {
        document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')
            .forEach(link => this.defaultFavicons.set(link, { href: link.getAttribute('href') || '', type: link.getAttribute('type') }));

        this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe(e => this.syncWithUrl(e.urlAfterRedirects));
    }

    // ---------- public API ----------

    /** Shows this tournament's branding (used right after saving it in the editor). */
    apply(branding: TournamentBranding) {
        this.requestedId = Number(branding.id);
        this.branding.set(branding);
        this.setCssVars(this.colorsOf(branding));
        this.setTabIdentity(branding);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(branding)); } catch { /* storage full: not critical */ }
    }

    /** Back to the default BidWicket look. */
    reset() {
        this.requestedId = null;
        this.branding.set(null);
        const root = document.documentElement.style;
        THEME_VARS.forEach(v => root.removeProperty(v));
        this.setTabIdentity(null);
    }

    /** Loads and shows a tournament's branding. Shows the cached copy first so pages don't flash. */
    async loadForTournament(id: number | string) {
        const tournamentId = Number(id);
        if (!tournamentId) return this.reset();
        if (this.requestedId === tournamentId && this.branding()) return;
        this.requestedId = tournamentId;

        const cached = this.readCache();
        if (cached && Number(cached.id) === tournamentId) this.apply(cached);

        try {
            const fresh = await firstValueFrom(
                this.http.get<TournamentBranding>(`${API_CONFIG.baseUrl}/api/tournaments/${tournamentId}/branding`)
            );
            // The user may have navigated to another tournament while this was loading
            if (this.requestedId === tournamentId) this.apply(fresh);
        } catch {
            if (this.requestedId === tournamentId && !cached) this.reset();
        }
    }

    async saveBranding(tournamentId: number | string, changes: Partial<TournamentBranding>) {
        const token = localStorage.getItem('token');
        const saved = await firstValueFrom(this.http.put<TournamentBranding>(
            `${API_CONFIG.baseUrl}/api/tournaments/${tournamentId}/branding`,
            changes,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        ));
        this.apply(saved);
        return saved;
    }

    /** Branded login link to share with a tournament's admin and team owners. */
    loginLink(tournamentId: number | string) {
        return `${window.location.origin}/login/${tournamentId}`;
    }

    imageUrl(file: string | null | undefined): string | null {
        if (!file) return null;
        if (file.startsWith('data:') || file.startsWith('blob:') || file.startsWith('http')) return file;
        return `${API_CONFIG.baseUrl}${TOURNAMENT_IMAGE_PATH}${file}`;
    }

    colorsOf(branding: Partial<TournamentBranding> | null | undefined): ThemeColors {
        return {
            primary: this.validHex(branding?.primaryColor) || DEFAULT_THEME.primary,
            secondary: this.validHex(branding?.secondaryColor) || DEFAULT_THEME.secondary,
            accent: this.validHex(branding?.accentColor) || DEFAULT_THEME.accent,
        };
    }

    /** CSS variables for a set of colors. Also used inline by the editor's live preview. */
    cssVarsFor(colors: ThemeColors): Record<string, string> {
        const p = this.hexToRgb(colors.primary);
        const s = this.hexToRgb(colors.secondary);
        const a = this.hexToRgb(colors.accent);
        const deep = this.shade(p, 0.55);
        return {
            '--primary': colors.primary,
            '--primary-rgb': p.join(', '),
            '--primary-dark': this.rgbToHex(this.shade(p, 0.6)),
            '--primary-deep': this.rgbToHex(deep),
            '--primary-deep-rgb': deep.join(', '),
            '--bg-sidebar': colors.primary,
            '--primary-light': colors.secondary,
            '--secondary-rgb': s.join(', '),
            '--secondary-dark': this.rgbToHex(this.shade(s, 0.82)),
            '--secondary-soft': this.rgbToHex(this.tint(s, 0.92)),
            '--secondary-ink': this.rgbToHex(this.shade(s, 0.45)),
            '--accent': colors.accent,
            '--accent-rgb': a.join(', '),
            '--accent-hover': this.rgbToHex(this.shade(a, 0.9)),
            '--on-accent': this.isLight(a) ? colors.primary : '#ffffff',
            '--on-secondary': this.isLight(s) ? '#0f172a' : '#ffffff',
        };
    }

    /** True when white text would be hard to read on this color (used to warn in the editor). */
    isLightColor(hex: string) {
        return this.isLight(this.hexToRgb(hex));
    }

    // ---------- URL -> tournament ----------

    private syncWithUrl(url: string) {
        const id = this.tournamentIdForUrl(url);
        if (id) this.loadForTournament(id);
        else this.reset();
    }

    private tournamentIdForUrl(url: string): number | null {
        const [path, query = ''] = url.split('?');
        const parts = path.split('/').filter(Boolean);
        const user = this.currentUser();

        switch (parts[0]) {
            case 'tournament-detail':
            case 'auction':
            case 'live':
            case 'login':
                return Number(parts[1]) || null;
            case 'team-dashboard':
                return Number(parts[1]) || Number(user?.team?.tournamentId) || null;
            case 'register':
                return Number(new URLSearchParams(query).get('tournamentId')) || null;
        }
        // A tournament admin only ever works inside their own tournament
        if (user?.role === 'TOURNAMENT_ADMIN' && user.tournamentId) return Number(user.tournamentId);
        return null;
    }

    private currentUser(): any {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    }

    private readCache(): TournamentBranding | null {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
    }

    // ---------- DOM ----------

    private setCssVars(colors: ThemeColors) {
        const root = document.documentElement.style;
        const isDefault = colors.primary === DEFAULT_THEME.primary
            && colors.secondary === DEFAULT_THEME.secondary
            && colors.accent === DEFAULT_THEME.accent;
        if (isDefault) {
            THEME_VARS.forEach(v => root.removeProperty(v));
            return;
        }
        Object.entries(this.cssVarsFor(colors)).forEach(([k, v]) => root.setProperty(k, v));
    }

    /** Browser tab title and icon follow the tournament too. */
    private setTabIdentity(branding: TournamentBranding | null) {
        document.title = branding ? `${branding.name} | BidWicket` : 'BidWicket';
        const logo = branding ? this.imageUrl(branding.logo) : null;
        this.defaultFavicons.forEach((original, link) => {
            if (logo) {
                link.setAttribute('href', logo);
                link.removeAttribute('type'); // the logo may be PNG/JPG/WEBP; let the browser sniff it
            } else {
                link.setAttribute('href', original.href);
                if (original.type) link.setAttribute('type', original.type);
            }
        });
    }

    // ---------- color math ----------

    private validHex(value: string | null | undefined) {
        return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
    }

    private hexToRgb(hex: string): [number, number, number] {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    private rgbToHex(rgb: number[]) {
        return '#' + rgb.map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
    }

    /** Darken: multiply each channel (factor < 1). */
    private shade(rgb: number[], factor: number): [number, number, number] {
        return rgb.map(c => Math.round(c * factor)) as [number, number, number];
    }

    /** Lighten: mix toward white by `amount` (0..1). */
    private tint(rgb: number[], amount: number): [number, number, number] {
        return rgb.map(c => Math.round(c + (255 - c) * amount)) as [number, number, number];
    }

    private isLight([r, g, b]: number[]) {
        // Relative luminance (WCAG); above ~0.45 white text loses contrast
        const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45;
    }
}
