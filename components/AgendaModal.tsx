'use client';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { MeetingWithClaims, Member } from '@/lib/types';
import { buildAgenda, ROLE_BLANK } from '@/lib/agenda';
import { formatMeetingDate } from '@/lib/utils';

interface Props {
  meeting: MeetingWithClaims;
  allMembers: Member[];
  onClose: () => void;
}

export function AgendaModal({ meeting, allMembers, onClose }: Props) {
  // Rebuilds whenever the meeting prop changes (realtime role/speech updates),
  // so the agenda stays in sync with the latest role selection.
  const agenda = useMemo(() => {
    const byId = new Map(allMembers.map((m) => [m.id, m]));
    return buildAgenda(meeting, byId);
  }, [meeting, allMembers]);

  // Portal to <body> so the fixed overlay covers the page's sticky header
  // (otherwise it can bleed through above the sheet on narrow screens).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="agenda-overlay fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="agenda-printable"
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-xl my-0 sm:my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-maroon-700 text-white px-5 py-4 sm:rounded-t-2xl print:bg-white print:text-stone-900 print:border-b-2 print:border-maroon-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-200 print:text-maroon-700">
                Dehradun WIC India Toastmasters Club
              </p>
              <h2 className="font-serif text-xl font-bold leading-tight mt-0.5">
                Meeting #{meeting.number} — Agenda
              </h2>
              <p className="text-xs text-white/80 print:text-stone-500 mt-1">
                {formatMeetingDate(meeting.date)} · {agenda.startsAt} – {agenda.endsAt} IST
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-white/70 hover:text-white text-2xl leading-none tap-target px-1 print:hidden"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {meeting.theme && (
            <p className="mt-2 text-sm">
              <span className="text-yellow-200 print:text-maroon-700 font-semibold">🌐 Theme: </span>
              <span className="font-serif font-semibold">{meeting.theme}</span>
            </p>
          )}
        </div>

        {/* Sections */}
        <div className="px-4 sm:px-5 py-4 space-y-6">
          {agenda.sections.map((section, si) => (
            <section key={section.key}>
              <h3 className="font-serif text-base font-bold text-maroon-800 flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-maroon-700 text-white text-xs font-bold print:bg-maroon-700">
                  {si + 1}
                </span>
                {section.title}
              </h3>
              <ol className="divide-y divide-stone-100 border-y border-stone-100">
                {section.rows.map((row, ri) => (
                  <li
                    key={ri}
                    className={`flex gap-3 py-2 ${row.indent ? 'pl-6 sm:pl-9 bg-stone-50/60' : ''}`}
                  >
                    <span className="shrink-0 w-16 text-xs font-semibold text-stone-400 tabular-nums pt-0.5">
                      {row.time}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-sm text-stone-800">
                          <span className="font-semibold">{row.lead}</span>
                          {row.callee !== undefined &&
                            (row.callee ? (
                              <span className="text-maroon-700 font-semibold"> {row.callee}</span>
                            ) : (
                              <span className="text-stone-400 font-medium"> {ROLE_BLANK}</span>
                            ))}
                        </span>
                        {row.allotment && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-navy-600 bg-navy-50 rounded px-1.5 py-0.5 print:border print:border-navy-600">
                            {row.allotment}
                          </span>
                        )}
                      </div>
                      {row.detail && (
                        <p className="text-xs text-stone-500 mt-0.5 italic">{row.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <p className="text-[11px] text-stone-400 leading-relaxed pt-1">
            Times are a guide, generated live from the current role sign-ups. Speech
            allotments default to the Pathways level (Level&nbsp;1 = 4–6 min, others = 5–7 min)
            and can be overridden per speaker via “Edit speech details”.
          </p>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-stone-100 px-5 py-3 flex justify-end gap-2 sm:rounded-b-2xl print:hidden">
          <button
            onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-700 px-4 py-2 tap-target"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm font-semibold bg-maroon-700 hover:bg-maroon-800 text-white px-4 py-2 rounded-full transition-colors tap-target"
          >
            🖨 Print / Save PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
