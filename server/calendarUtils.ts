import { google } from 'googleapis';

interface SyncShiftParams {
  userProviderToken: string;
  shiftDate: string; // '2026-03-16'
  shiftCode: string; // 'AM'
  startTime: string; // '08:00:00'
  endTime: string;   // '17:00:00'
}

export async function syncShiftToGoogleCalendar({
  userProviderToken,
  shiftDate,
  shiftCode,
  startTime,
  endTime
}: SyncShiftParams) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: userProviderToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const timezone = 'Asia/Kuala_Lumpur';

  const event = {
    summary: `Ward Shift: ${shiftCode}`,
    description: `Assigned hospital shift: ${shiftCode}`,
    start: {
      dateTime: `${shiftDate}T${startTime}`,
      timeZone: timezone,
    },
    end: {
      dateTime: `${shiftDate}T${endTime}`,
      timeZone: timezone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1-hour reminder
      ],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    return { success: true, eventId: response.data.id };
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
    throw error;
  }
}
