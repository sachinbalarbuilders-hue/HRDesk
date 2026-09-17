export const formatDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const format = localStorage.getItem('hrdesk_date_format') || 'DD/MM/YYYY';
  const timeZone = (localStorage.getItem('hrdesk_time_zone') || 'Asia/Kolkata').split(' ')[0]; // Extract "Asia/Kolkata" from "Asia/Kolkata (UTC+05:30)"

  const options: Intl.DateTimeFormatOptions = { timeZone };

  if (format === 'DD MMM YYYY') {
    options.day = '2-digit';
    options.month = 'short';
    options.year = 'numeric';
    return date.toLocaleDateString('en-GB', options);
  }
  
  if (format === 'MM/DD/YYYY') {
    options.month = '2-digit';
    options.day = '2-digit';
    options.year = 'numeric';
    return date.toLocaleDateString('en-US', options);
  }

  if (format === 'YYYY-MM-DD') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  }

  // Default DD/MM/YYYY
  options.day = '2-digit';
  options.month = '2-digit';
  options.year = 'numeric';
  return date.toLocaleDateString('en-GB', options);
};

export const formatTime = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const format = localStorage.getItem('hrdesk_time_format') || '12-Hour';
  const timeZone = (localStorage.getItem('hrdesk_time_zone') || 'Asia/Kolkata').split(' ')[0];

  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12-Hour',
  };

  return date.toLocaleTimeString('en-US', options);
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '-';

  const currencyCode = localStorage.getItem('hrdesk_currency') || 'INR';

  // Determine locale based on currency for better native formatting
  let locale = 'en-IN';
  if (currencyCode === 'USD') locale = 'en-US';
  else if (currencyCode === 'EUR') locale = 'en-IE'; // European english
  else if (currencyCode === 'GBP') locale = 'en-GB';
  else if (currencyCode === 'AED') locale = 'ar-AE';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
};
