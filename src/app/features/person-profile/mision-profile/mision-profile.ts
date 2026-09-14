import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-mision-profile',
  templateUrl: './mision-profile.html',
  styleUrl: './mision-profile.scss',
})
export class MisionProfile {
  @Input() mision = '';
  @Input() vision = '';
}
