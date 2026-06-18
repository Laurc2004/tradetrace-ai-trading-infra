import type { RunEvent } from '@/lib/types';

export function Timeline({ events }: { events: RunEvent[] }) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <article className="event-card" key={event.event_id}>
          <div className="event-dot" />
          <div className="event-content">
            <div className="event-meta">
              <span>{event.type}</span>
              <span>{event.actor}</span>
              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <h3>{event.output_summary}</h3>
            <p>{event.input_summary}</p>
            <div className="event-footer">
              <span>{event.status}</span>
              <span>{event.duration_ms}ms</span>
              {event.raw_ref ? <span>{event.raw_ref}</span> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
