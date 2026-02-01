// State Store - centralized state management with pub/sub pattern

class Store {
  constructor() {
    this.state = {
      connected: false,
      status: null,
      shotData: [],
      currentView: 'live',
      selectedShotId: null,
      visibleSeries: [],
      dataSeries: []
    };
    
    this.listeners = new Map();
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners of changed keys
    Object.keys(updates).forEach(key => {
      if (oldState[key] !== this.state[key]) {
        this.emit(key, this.state[key]);
        this.emit('change', { key, value: this.state[key] });
      }
    });
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  emit(key, value) {
    this.listeners.get(key)?.forEach(cb => cb(value));
  }

  // Convenience methods
  setConnected(connected) {
    this.setState({ connected });
  }

  setStatus(status) {
    this.setState({ status });
  }

  setShotData(shotData) {
    this.setState({ shotData });
  }

  appendShotData(point) {
    this.setState({ shotData: [...this.state.shotData, point] });
  }

  clearShotData() {
    this.setState({ shotData: [] });
  }

  setCurrentView(view) {
    this.setState({ currentView: view, selectedShotId: null });
  }

  setSelectedShot(shotId) {
    this.setState({ selectedShotId: shotId, currentView: 'detail' });
  }

  setVisibleSeries(series) {
    this.setState({ visibleSeries: series });
  }

  setDataSeries(series) {
    this.setState({ dataSeries: series });
  }
}

// Singleton instance
export const store = new Store();
