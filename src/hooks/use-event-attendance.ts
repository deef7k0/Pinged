import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { cancelAttendance, getEventAttendance, setAttendance, setReminder } from '@/lib/api';
import type { AttendanceMode } from '@/lib/database.types';
import type { GameEvent } from '@/lib/news';
import { REMINDER_LEAD_MINUTES, cancelEventReminder, scheduleEventReminder } from '@/lib/reminders';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/** Why a reminder could not be set, in words the reader can act on. */
const REMINDER_FAILURE: Record<'denied' | 'past' | 'unavailable', string> = {
  denied: 'Allow notifications in your system settings to set reminders.',
  past: `This event starts too soon for a ${REMINDER_LEAD_MINUTES}-minute reminder.`,
  unavailable: 'Reminders need a development build — RSVP still works here.',
};

/**
 * Somebody's attendance at one event, and the two things they can do about
 * it: say how they are attending (or that they are not), and set a reminder.
 *
 * One record, whichever control writes it — `<EventRsvp>` on a News card and
 * the event page's foot bar both read and write through here, under the same
 * key, so either can undo what the other did.
 *
 * The reminder is a local notification scheduled under an id made from the
 * event's (`lib/reminders`), so it can be cancelled from any screen on any
 * later visit; `event_attendance.reminder_at` is what keeps the *fact* of it
 * across launches. Cancelling attendance cancels the reminder with it.
 */
export function useEventAttendance(event: GameEvent) {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const eventId = `igdb:${event.id}`;

  const [notice, setNotice] = useState<string | null>(null);

  const attendance = useQuery({
    queryKey: ['event-attendance', eventId, userId],
    queryFn: () => getEventAttendance(eventId, userId ?? null),
    enabled: !!eventId,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['event-attendance', eventId] });
    void queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
    // The wall shows attendance as activity.
    void queryClient.invalidateQueries({ queryKey: ['wall', userId] });
  }

  const rsvp = useMutation({
    mutationFn: async (mode: AttendanceMode | null) => {
      if (!userId) throw new Error('You must be signed in.');

      if (mode === null) {
        // Cancelling attendance should not leave an orphaned reminder firing.
        await cancelEventReminder(eventId);
        await cancelAttendance(userId, eventId);
        return;
      }

      await setAttendance(userId, event, mode, attendance.data?.mine?.reminder_at ?? null);
    },
    onSuccess: (_result, mode) => {
      toast.success(mode ? 'Saved — see you there' : 'No longer going');
      return invalidate();
    },
  });

  const reminder = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      setNotice(null);

      // Toggling off.
      if (attendance.data?.mine?.reminder_at) {
        await cancelEventReminder(eventId);
        await setReminder(userId, eventId, null);
        return;
      }

      if (!event.startsAt) {
        setNotice('This event has no announced start time yet.');
        return;
      }

      const result = await scheduleEventReminder(eventId, event.name, event.startsAt);
      if (!result.ok) {
        setNotice(REMINDER_FAILURE[result.reason]);
        return;
      }

      await setReminder(userId, eventId, result.firesAt.toISOString());
    },
    onSuccess: invalidate,
  });

  const mine = attendance.data?.mine ?? null;
  return {
    eventId,
    mine,
    total: attendance.data?.total ?? 0,
    inPerson: attendance.data?.inPerson ?? 0,
    hasReminder: !!mine?.reminder_at,
    rsvp,
    reminder,
    notice,
  };
}
