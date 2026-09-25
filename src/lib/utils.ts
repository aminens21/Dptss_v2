import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMatchDate(dateVal: any): string {
  if (!dateVal) return '--';
  let d: Date;

  try {
    if (typeof dateVal === 'string') {
      const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(dateVal);
      }
    } else if (dateVal && typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal.seconds !== undefined) {
        d = new Date(dateVal.seconds * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        d = new Date(dateVal);
      }
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) {
      return String(dateVal);
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return String(dateVal);
  }
}

