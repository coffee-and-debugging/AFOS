import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { OfflineBanner } from './States';
import { getAuthUser } from '../api/client';
import { useRestaurant } from '../hooks';

/** Poster-style hero for guest pages: script kicker, big condensed headline, amber table chip. */
export default function GuestHeader({ kicker = 'Hot & Delicious', title, chip, action }: {
  kicker?: string;
  title?: string;
  chip?: string;
  action?: ReactNode;
}) {
  const { restaurant } = useRestaurant();
  const staff = getAuthUser()?.role;

  return (
    <>
      <OfflineBanner />
      <header className="guest-hero">
        <div className="guest-hero-inner">
          {staff && staff !== 'chef' && (
            <Link to="/tables" className="icon-btn" aria-label="Back to staff app">
              <Icon name="tables" />
            </Link>
          )}
          <div className="spacer">
            <div className="hero-kicker">{kicker}</div>
            <h1 className="hero-title">{title ?? restaurant.name}</h1>
            {!title && restaurant.tagline && <p className="hero-sub">{restaurant.tagline}</p>}
            {chip && <span className="table-chip">{chip}</span>}
          </div>
          {action}
        </div>
      </header>
    </>
  );
}
