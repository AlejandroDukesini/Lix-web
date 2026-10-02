import { Component } from 'react';

/**
 * Último recurso ante un error de renderizado: muestra una pantalla de
 * recuperación en lugar de dejar la página en blanco. Los datos guardados no se tocan.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app] Error no controlado en la interfaz:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__flame" aria-hidden="true" />
        <h1>Algo se apagó por un momento</h1>
        <p>
          Ocurrió un error inesperado en la pantalla. Tus datos siguen guardados en este dispositivo; puedes intentar de nuevo o
          recargar la aplicación.
        </p>
        <div className="fatal-error__actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={() => this.setState({ error: null })}>
            <span className="btn__label">Intentar de nuevo</span>
          </button>
          <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>
            <span className="btn__label">Recargar</span>
          </button>
        </div>
      </main>
    );
  }
}
