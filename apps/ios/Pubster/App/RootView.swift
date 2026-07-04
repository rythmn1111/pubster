import SwiftUI

/// Top-level view that switches between launch, onboarding, and the main app
/// based on ``AppState/phase``.
struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            switch appState.phase {
            case .launching:
                LaunchView()
            case .onboarding:
                OnboardingView()
            case .main:
                DiscoverView()
            }
        }
        .animation(.easeInOut, value: phaseKey)
        .task {
            if appState.phase == .launching {
                await appState.bootstrap()
            }
        }
    }

    private var phaseKey: Int {
        switch appState.phase {
        case .launching: return 0
        case .onboarding: return 1
        case .main: return 2
        }
    }
}

/// Brief splash while ``AppState/bootstrap()`` runs.
struct LaunchView: View {
    var body: some View {
        ZStack {
            ScreenBackground()
            VStack(spacing: Spacing.lg) {
                ZStack {
                    Circle()
                        .fill(LinearGradient.pubAccentGradient)
                        .frame(width: 88, height: 88)
                        .softShadow(radius: 16, y: 8, opacity: 0.18)
                    Image(systemName: "mug.fill")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text("Pubster")
                    .font(.pubDisplay)
                    .foregroundStyle(Color.pubEspresso)
                ProgressView()
                    .tint(.pubAccent)
                    .padding(.top, Spacing.xs)
            }
        }
    }
}
