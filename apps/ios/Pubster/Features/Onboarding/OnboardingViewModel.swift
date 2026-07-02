import Foundation

/// Drives the onboarding state machine:
/// phone → OTP (dummy `000000`) → name (first-time only) → location permission.
@MainActor
final class OnboardingViewModel: ObservableObject {
    enum Step {
        case phone
        case otp
        case name
        case location
    }

    @Published var step: Step = .phone
    @Published var phone = ""
    @Published var code = "000000" // dummy OTP, pre-filled for testing
    @Published var name = ""
    @Published var isSubmitting = false
    @Published var errorMessage: String?
    @Published private(set) var verifiedUser: UserDTO?

    /// Phone with formatting characters stripped (keeps a leading `+`).
    var normalizedPhone: String {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasPlus = trimmed.hasPrefix("+")
        let digits = trimmed.filter(\.isNumber)
        return hasPlus ? "+" + digits : digits
    }

    var isValidPhone: Bool {
        let digits = normalizedPhone.filter(\.isNumber)
        return digits.count >= 7 && digits.count <= 15
    }

    func sendCode(api: APIClient) async {
        errorMessage = nil
        guard isValidPhone else {
            errorMessage = "Enter a valid phone number."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await api.requestOtp(phone: normalizedPhone)
            step = .otp
        } catch {
            errorMessage = message(for: error)
        }
    }

    func verify(api: APIClient) async {
        errorMessage = nil
        guard !code.isEmpty else {
            errorMessage = "Enter the code."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let auth = try await api.verifyOtp(phone: normalizedPhone, code: code, name: nil)
            verifiedUser = auth.user
            step = (auth.user.name?.isEmpty ?? true) ? .name : .location
        } catch {
            errorMessage = message(for: error)
        }
    }

    func submitName(api: APIClient) async {
        errorMessage = nil
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Enter your name."
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let auth = try await api.verifyOtp(phone: normalizedPhone, code: code, name: trimmed)
            verifiedUser = auth.user
            step = .location
        } catch {
            errorMessage = message(for: error)
        }
    }

    private func message(for error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}
