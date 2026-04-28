import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * @param time - Time in "HH:MM" format (24-hour)
 * @returns Time in "h:MM AM/PM" format
 */
export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert 24-hour time format to short 12-hour format (no minutes if :00)
 * @param time - Time in "HH:MM" format (24-hour)
 * @returns Time in "h AM/PM" or "h:MM AM/PM" format
 */
export function formatTime12HourShort(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHours} ${period}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format a time range from 24-hour to 12-hour format
 * @param startTime - Start time in "HH:MM" format
 * @param endTime - End time in "HH:MM" format
 * @returns Time range in "h:MM AM/PM - h:MM AM/PM" format
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
}

/**
 * Parse 12-hour time to 24-hour format
 * @param time12 - Time in "h:MM AM/PM" format
 * @returns Time in "HH:MM" format (24-hour)
 */
export function parseTime12Hour(time12: string): string {
  const match = time12.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
  if (!match) return time12;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2] || '00';
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}
