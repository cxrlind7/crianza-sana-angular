import { Component } from '@angular/core';
import { Featured } from './featured/featured';
import { TeamGrid } from './team-grid/team-grid';

@Component({
  selector: 'app-about',
  imports: [Featured, TeamGrid],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {}
