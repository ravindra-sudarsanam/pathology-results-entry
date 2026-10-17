const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Thu, 15 Oct 2026, 09:30" in the viewer's time zone. */
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** "15 Oct" */
export const formatShortDate = (iso: string) => shortDateFormat.format(new Date(iso));

/** "09:30" */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

export const formatSex = (sex: 'female' | 'male') => (sex === 'female' ? 'Female' : 'Male');

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
