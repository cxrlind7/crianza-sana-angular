import { Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  count: number;
  color?: string;
  /** Texto extra a la derecha (p. ej. "3 sin respuesta"). */
  extra?: string;
}

/**
 * Lista de barras horizontales: etiqueta, barra proporcional al mayor y valor.
 * Más legible que una gráfica para pocas categorías, y no necesita Chart.js.
 */
@Component({
  selector: 'app-bar-list',
  template: `
    @if (items().length) {
      <ul class="bar-list">
        @for (item of items(); track item.label) {
          <li [title]="item.label + ': ' + item.count">
            <div class="bar-head">
              <span class="bar-label">{{ item.label }}</span>
              <span class="bar-value">
                {{ item.count.toLocaleString('es-MX') }}{{ unit() }}
                @if (showShare() && total()) {
                  <small>· {{ ((item.count / total()) * 100).toFixed(0) }}%</small>
                }
                @if (item.extra) {
                  <small>· {{ item.extra }}</small>
                }
              </span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" [class.some]="item.count > 0" [style.width.%]="max() ? (item.count / max()) * 100 : 0" [style.background]="item.color || color()"></div>
            </div>
          </li>
        }
      </ul>
    } @else {
      <p class="bar-empty">{{ empty() }}</p>
    }
  `,
  styles: `
    .bar-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.85rem;
      margin-bottom: 4px;
    }
    .bar-label {
      color: var(--dm-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-value {
      flex-shrink: 0;
      font-weight: 700;
      color: var(--dm-text);
      small {
        font-weight: 500;
        color: var(--dm-text-secondary);
      }
    }
    .bar-track {
      height: 8px;
      border-radius: 4px;
      background: var(--dm-surface-2);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    /* Un valor pequeño se ve, pero el cero no deja rastro. */
    .bar-fill.some {
      min-width: 4px;
    }
    .bar-empty {
      margin: 0;
      font-size: 0.85rem;
      color: var(--dm-text-secondary);
    }
  `,
})
export class BarList {
  readonly items = input<BarItem[]>([]);
  readonly color = input('#2a78d6');
  readonly unit = input('');
  readonly showShare = input(false);
  readonly empty = input('Aún sin datos en este periodo.');

  readonly max = computed(() => Math.max(0, ...this.items().map((i) => i.count)));
  readonly total = computed(() => this.items().reduce((n, i) => n + i.count, 0));
}
