import { Component, type ErrorInfo, type ReactNode } from 'react'
import './HUD/HUD.css'

interface Props {
    children: ReactNode
    /** Called before the scene is remounted, e.g. to start a fresh game */
    onRestart: () => void
}

interface State {
    error: Error | null
}

/**
 * Catches errors from the 3D scene so a crash shows a Restart prompt instead of
 * a black screen (G-8). Restarting remounts the children, which recreates the
 * Canvas and with it the Physics world.
 */
export default class SceneErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Scene crashed:', error, info.componentStack)
    }

    private restart = () => {
        this.props.onRestart()
        this.setState({ error: null })
    }

    render() {
        if (!this.state.error) return this.props.children
        return (
            <div className="hud-modal-overlay" role="alert">
                <div className="hud-modal">
                    <h2>SCENE CRASHED</h2>
                    <p>{this.state.error.message}</p>
                    <div className="hud-modal-actions">
                        <button className="hud-reset-button" onClick={this.restart}>
                            RESTART
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}
