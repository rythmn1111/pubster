import Foundation
import SwiftUI

/// Root app state + simple router. Holds the shared ``APIClient`` and drives the
/// top-level navigation phase (launch → onboarding → main).
@MainActor
final class AppState: ObservableObject {
    enum Phase {
        case launching
        case onboarding
        case main
    }

    @Published var phase: Phase = .launching
    @Published var currentUser: UserDTO?

    let tokenStore: TokenStore
    let api: APIClient

    init() {
        let store = TokenStore()
        self.tokenStore = store
        self.api = APIClient(baseURL: AppConfig.apiBaseURL, tokenStore: store)
    }

    /// Decide the initial screen. If we hold tokens, validate them via
    /// `/auth/me`; otherwise go straight to onboarding.
    func bootstrap() async {
        guard tokenStore.hasTokens else {
            phase = .onboarding
            return
        }
        do {
            let user = try await api.me()
            currentUser = user
            phase = .main
        } catch {
            await api.logout()
            phase = .onboarding
        }
    }

    func completeLogin(with user: UserDTO) {
        currentUser = user
        phase = .main
    }

    func signOut() {
        let api = self.api
        Task { await api.logout() }
        currentUser = nil
        phase = .onboarding
    }
}
