import { describe, it, expect } from 'vitest';

describe('Seminar and Conference Event Configuration Rules', () => {
  const isSeminarOrConference = (category?: string, eventType?: string) => {
    return ['seminar', 'conference'].includes(
      String(category || eventType || '').toLowerCase()
    );
  };

  it('correctly detects seminar and conference categories (case-insensitive)', () => {
    expect(isSeminarOrConference('seminar')).toBe(true);
    expect(isSeminarOrConference('Seminar')).toBe(true);
    expect(isSeminarOrConference('conference')).toBe(true);
    expect(isSeminarOrConference('CONFERENCE')).toBe(true);
    expect(isSeminarOrConference('', 'seminar')).toBe(true);
    expect(isSeminarOrConference('', 'Conference')).toBe(true);

    expect(isSeminarOrConference('competition')).toBe(false);
    expect(isSeminarOrConference('contest')).toBe(false);
    expect(isSeminarOrConference('esports')).toBe(false);
    expect(isSeminarOrConference('other')).toBe(false);
  });

  it('enforces individual registration mode for seminar and conference', () => {
    const handleCategoryChangeSimulation = (category: string) => {
      const isSemOrConf = isSeminarOrConference(category);
      return {
        categorySelect: category,
        eventType: category,
        registrationMode: isSemOrConf ? 'individual' : 'team',
        requiresCoach: isSemOrConf ? false : true,
        bannerUrl: isSemOrConf ? null : 'https://example.com/banner.jpg',
      };
    };

    const seminarState = handleCategoryChangeSimulation('seminar');
    expect(seminarState.registrationMode).toBe('individual');
    expect(seminarState.requiresCoach).toBe(false);
    expect(seminarState.bannerUrl).toBeNull();

    const conferenceState = handleCategoryChangeSimulation('conference');
    expect(conferenceState.registrationMode).toBe('individual');
    expect(conferenceState.requiresCoach).toBe(false);
    expect(conferenceState.bannerUrl).toBeNull();

    const competitionState = handleCategoryChangeSimulation('competition');
    expect(competitionState.registrationMode).toBe('team');
    expect(competitionState.requiresCoach).toBe(true);
    expect(competitionState.bannerUrl).toBe('https://example.com/banner.jpg');
  });

  it('ensures payload sanitization for seminars and conferences disables coach and removes banner', () => {
    const sanitizeEventPayload = (formData: {
      categorySelect: string;
      eventType: string;
      registrationMode: string;
      requiresCoach: boolean;
      bannerUrl: string | null;
    }) => {
      const isSemOrConf = isSeminarOrConference(formData.categorySelect, formData.eventType);
      return {
        registrationMode: isSemOrConf ? 'individual' : formData.registrationMode,
        requiresCoach: isSemOrConf ? false : formData.requiresCoach,
        bannerUrl: isSemOrConf ? null : formData.bannerUrl,
      };
    };

    const payload = sanitizeEventPayload({
      categorySelect: 'seminar',
      eventType: 'seminar',
      registrationMode: 'team',
      requiresCoach: true,
      bannerUrl: 'https://example.com/uploaded.png',
    });

    expect(payload.registrationMode).toBe('individual');
    expect(payload.requiresCoach).toBe(false);
    expect(payload.bannerUrl).toBeNull();
  });
});
