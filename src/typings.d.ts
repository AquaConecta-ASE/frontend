declare module 'chart.js';
declare module 'chart.js/auto';

// Minimal Chart type to allow .Chart usage in dynamic import results
declare namespace ChartJS {
  interface ChartConfiguration {
    type?: string;
    data?: any;
    options?: any;
  }
  interface Chart {
    destroy(): void;
  }
}

export {};
