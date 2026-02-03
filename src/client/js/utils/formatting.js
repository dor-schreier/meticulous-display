// Formatting utilities for display values

export const formatTime = (seconds) => 
  seconds == null ? '--' : `${seconds.toFixed(1)}s`;

export const formatWeight = (grams) => 
  grams == null ? '--' : `${grams.toFixed(1)}g`;

export const formatFlow = (mlPerSec) => 
  mlPerSec == null ? '--' : `${mlPerSec.toFixed(1)}`;

export const formatTemp = (celsius) => 
  celsius == null ? '--' : `${celsius.toFixed(1)}°C`;

export const formatTimeOfDay = (timestamp) => {
  // Handle Unix timestamp (seconds) by converting to milliseconds
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatFullDateTime = (timestamp) => {
  // Handle Unix timestamp (seconds) by converting to milliseconds
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateHeader = (dateString) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (dateString === today) return 'Today';
  if (dateString === yesterday) return 'Yesterday';
  return new Date(dateString).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
};
