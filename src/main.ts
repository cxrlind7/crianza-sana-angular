import { bootstrapApplication } from '@angular/platform-browser';
import { register } from 'swiper/element/bundle';
import 'bootstrap';
import { appConfig } from './app/app.config';
import { App } from './app/app';

register();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
