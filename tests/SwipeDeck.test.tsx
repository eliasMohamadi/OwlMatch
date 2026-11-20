import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';
import { SwipeDeck } from '../src/features/discovery/SwipeDeck';
import type { RecommendationItem } from '../shared/types';

MotionGlobalConfig.skipAnimations = true;

function item(id: string, title: string): RecommendationItem {
  const start = '2026-11-22T00:00:00.000Z';
  return {
    event: {
      id, title, description: 'desc', categories: ['gaming'], tags: [], kind: 'event', campus: 'marietta', venue: 'Student Center',
      address: 'Room 1', locationNote: null, start, end: '2026-11-22T03:00:00.000Z', groupSize: 'small', energy: 'relaxed',
      beginnerFriendly: true, capacity: null, visibility: 'public',
      organizer: { name: 'Jordan', kind: 'student', studentId: 'stu-jordan', verification: 'demo-simulated' },
      source: { type: 'student', label: 'Posted by a student', url: null, verifiedAt: null },
      rsvpUrl: null, coverImageUrl: null, createdAt: start, status: 'active',
      interestedCount: 2, goingTogetherCount: 1, reportCount: 0,
      viewer: { decision: null, optedIn: false, isHost: false, joinStatus: null },
    },
    recommendation: {
      eventId: id, score: 91, scoreSource: 'ai', reason: 'You said you like casual gaming.', matchedInterests: ['Gaming'], socialNote: null,
      breakdown: { interest: 1, keyword: 1, availability: 1, social: 1, feedback: 0.5 },
    },
  };
}

const items = [item('a', 'Game Night'), item('b', 'Board Games')];

describe('SwipeDeck accessibility', () => {
  it('shows the top card with its real score and reason', () => {
    render(<SwipeDeck items={items} onDecide={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Game Night' })).toBeInTheDocument();
    expect(screen.getByText('You said you like casual gaming.')).toBeInTheDocument();
    expect(screen.getByText(/AI match 91%/)).toBeInTheDocument();
  });

  it('supports explicit buttons instead of gestures', async () => {
    const onDecide = vi.fn();
    const onOpen = vi.fn();
    render(<SwipeDeck items={items} onDecide={onDecide} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Interested', exact: true }));
    expect(onDecide).toHaveBeenCalledWith(items[0], 'interested');
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
  });

  it('supports the keyboard', async () => {
    const onDecide = vi.fn();
    render(<SwipeDeck items={items} onDecide={onDecide} onOpen={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await vi.waitFor(() => expect(onDecide).toHaveBeenCalledWith(items[0], 'passed'));
  });
});
