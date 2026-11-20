import { describe, it, expect } from 'vitest';

describe('Dynamic Event Time In & Time Out Rules', () => {
  const TIME_IN_OPENS_BEFORE_MIN = 60; // 1 hour before start
  const TIME_OUT_CLOSES_AFTER_MIN = 60; // 1 hour after end

  function computeEventAttendanceSchedule(startAtIso: string, endAtIso: string) {
    const startMs = Date.parse(startAtIso);
    const endMs = Date.parse(endAtIso);
    const timeInOpensMs = startMs - TIME_IN_OPENS_BEFORE_MIN * 60000;
    const timeInClosesMs = endMs;
    const timeOutClosesMs = endMs + TIME_OUT_CLOSES_AFTER_MIN * 60000;

    return {
      startMs,
      endMs,
      timeInOpensMs,
      timeInClosesMs,
      timeOutClosesMs,
    };
  }

  function resolvePhase(
    schedule: ReturnType<typeof computeEventAttendanceSchedule>,
    nowMs: number
  ): 'not_open' | 'gate_open' | 'in_progress' | 'time_out_window' | 'ended' {
    if (nowMs < schedule.timeInOpensMs) return 'not_open';
    if (nowMs < schedule.startMs) return 'gate_open';
    if (nowMs <= schedule.endMs) return 'in_progress';
    if (nowMs <= schedule.timeOutClosesMs) return 'time_out_window';
    return 'ended';
  }

  it('calculates dynamic time-in starting exactly 1 hour before start time', () => {
    // Event: Nov 20, 2026, 11:00 PM to Nov 21, 2026, 02:00 AM
    const schedule = computeEventAttendanceSchedule(
      '2026-11-20T23:00:00+08:00',
      '2026-11-21T02:00:00+08:00'
    );

    // Time in opens at 10:00 PM (1 hour before 11:00 PM)
    const expectedOpensMs = Date.parse('2026-11-20T22:00:00+08:00');
    expect(schedule.timeInOpensMs).toBe(expectedOpensMs);

    // 2 hours before (9:00 PM): not open
    const at9pm = Date.parse('2026-11-20T21:00:00+08:00');
    expect(resolvePhase(schedule, at9pm)).toBe('not_open');

    // 30 mins before start (10:30 PM): gate open (time-in allowed)
    const at1030pm = Date.parse('2026-11-20T22:30:00+08:00');
    expect(resolvePhase(schedule, at1030pm)).toBe('gate_open');
  });

  it('calculates dynamic time-out window extending 1 hour after event end', () => {
    // Event: Nov 20, 2026, 11:00 PM to Nov 21, 2026, 02:00 AM
    const schedule = computeEventAttendanceSchedule(
      '2026-11-20T23:00:00+08:00',
      '2026-11-21T02:00:00+08:00'
    );

    // Time-out window closes at 3:00 AM (1 hour after 2:00 AM)
    const expectedTimeoutClosesMs = Date.parse('2026-11-21T03:00:00+08:00');
    expect(schedule.timeOutClosesMs).toBe(expectedTimeoutClosesMs);

    // During event (12:00 AM): in progress (time-in and time-out active)
    const atMidnight = Date.parse('2026-11-21T00:00:00+08:00');
    expect(resolvePhase(schedule, atMidnight)).toBe('in_progress');

    // 20 minutes after event ended (02:20 AM): time_out_window (time-out still active!)
    const at220am = Date.parse('2026-11-21T02:20:00+08:00');
    expect(resolvePhase(schedule, at220am)).toBe('time_out_window');

    // More than 1 hour after event ended (03:15 AM): attendance ended/closed
    const at315am = Date.parse('2026-11-21T03:15:00+08:00');
    expect(resolvePhase(schedule, at315am)).toBe('ended');
  });
});
