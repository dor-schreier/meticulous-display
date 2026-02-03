// Shot History Component - displays list of past shots
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api/client.js';
import { formatWeight, formatTime, formatFullDateTime, formatDateHeader } from '../utils/formatting.js';

const html = htm.bind(h);

const ChevronRightIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;

function ShotItem({ shot, onClick }) {
  // Prefer local cached image, fall back to remote
  const profileImage = shot.profileImageLocal || shot.profileImage || shot.profile?.display?.image;
  const imageUrl = profileImage ? `/api/profile-image/${encodeURIComponent(profileImage)}` : null;

  return html`
    <div class="shot-item" onClick=${onClick}>
      ${imageUrl && html`
        <div class="shot-item__image">
          <img src=${imageUrl} alt=${shot.profileName || 'Profile'} />
        </div>
      `}
      <div class="shot-item__main">
        <div class="shot-item__profile">${shot.profileName || 'Unknown'}</div>
        <div class="shot-item__stats">
          <span class="shot-item__stat">
            <span class="shot-item__stat-value">${formatWeight(shot.yieldWeight)}</span>
          </span>
          <span class="shot-item__stat">
            <span class="shot-item__stat-value">${formatTime(shot.duration)}</span>
          </span>
        </div>
      </div>
      <div class="shot-item__right">
        <div class="shot-item__time">${formatFullDateTime(shot.time)}</div>
        <div class="shot-item__rating">
          ${shot.rating === 'like' ? '👍' : shot.rating === 'dislike' ? '👎' : '−'}
        </div>
      </div>
      <span class="shot-item__chevron">${ChevronRightIcon}</span>
    </div>
  `;
}

export function HistoryView({ onSelectShot }) {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getHistory(50, 0)
      .then(data => {
        setShots(data.shots || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load history:', err);
        setLoading(false);
      });
  }, []);
  
  if (loading) {
    return html`
      <div class="loading">
        <div class="loading__spinner"></div>
        <span>Loading history...</span>
      </div>
    `;
  }
  
  // Group by date
  const grouped = {};
  shots.forEach(shot => {
    // Handle Unix timestamp (seconds) by converting to milliseconds
    const ms = shot.time < 10000000000 ? shot.time * 1000 : shot.time;
    const date = new Date(ms).toDateString();
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(shot);
  });
  
  return html`
    <div class="shot-list">
      ${Object.entries(grouped).map(([date, dayShots]) => html`
        <div key=${date}>
          <div class="section-header">${formatDateHeader(date)}</div>
          ${dayShots.map(shot => html`
            <${ShotItem} 
              key=${shot.id} 
              shot=${shot} 
              onClick=${() => onSelectShot(shot.id)} 
            />
          `)}
        </div>
      `)}
    </div>
  `;
}
